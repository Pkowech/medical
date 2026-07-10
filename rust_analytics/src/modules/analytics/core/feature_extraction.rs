use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres, Row};

#[derive(Debug, Serialize, Deserialize)]
pub struct UserFeatures {
    pub completed_materials: i32,
    pub average_score: f64,
    pub study_time: i32,
    pub preferred_categories: Vec<String>,
    pub last_activity: DateTime<Utc>,
    pub difficulty_preference: f64,
    pub learning_style: f64,
    pub engagement_level: f64,
    pub quiz_performance: f64,
    pub material_interaction: f64,
}

#[derive(Debug, sqlx::FromRow)]
pub struct User {
    #[allow(dead_code)]
    pub id: String,
    pub preferences: Option<serde_json::Value>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct LearningHistoryItem {
    #[allow(dead_code)]
    pub material_id: String,
    pub score: Option<f64>,
    pub duration: Option<i32>,
    pub category: String,
    pub timestamp: DateTime<Utc>,
    pub difficulty: Option<f64>,
    pub engagement: Option<f64>,
    pub item_type: Option<String>,
    pub interaction_score: Option<f64>,
}

// Helper functions
fn calculate_average_score(history: &[LearningHistoryItem]) -> f64 {
    if history.is_empty() {
        0.0
    } else {
        let total_score: f64 = history.iter().filter_map(|item| item.score).sum();
        total_score / history.len() as f64
    }
}

fn calculate_total_study_time(history: &[LearningHistoryItem]) -> i32 {
    history.iter().filter_map(|item| item.duration).sum()
}

fn extract_preferred_categories(history: &[LearningHistoryItem]) -> Vec<String> {
    history
        .iter()
        .map(|item| item.category.clone())
        .collect::<std::collections::HashSet<String>>()
        .into_iter()
        .collect()
}

fn get_last_activity_date(history: &[LearningHistoryItem]) -> DateTime<Utc> {
    history
        .iter()
        .map(|item| item.timestamp)
        .max()
        .unwrap_or_else(Utc::now)
}

fn calculate_difficulty_preference(history: &[LearningHistoryItem]) -> f64 {
    if history.is_empty() {
        0.5
    } else {
        let total_difficulty: f64 = history.iter().filter_map(|item| item.difficulty).sum();
        total_difficulty / history.len() as f64
    }
}

fn determine_learning_style(preferences: &Option<serde_json::Value>) -> f64 {
    preferences
        .as_ref()
        .and_then(|prefs| prefs.get("learningStyle"))
        .and_then(|style| style.as_f64())
        .unwrap_or(0.5)
}

fn calculate_engagement_level(history: &[LearningHistoryItem]) -> f64 {
    if history.is_empty() {
        0.0
    } else {
        let total_engagement: f64 = history.iter().filter_map(|item| item.engagement).sum();
        total_engagement / history.len() as f64
    }
}

fn calculate_quiz_performance(history: &[LearningHistoryItem]) -> f64 {
    let quiz_history: Vec<&LearningHistoryItem> = history
        .iter()
        .filter(|item| item.item_type.as_deref() == Some("quiz"))
        .collect();
    if quiz_history.is_empty() {
        0.0
    } else {
        let total_quiz_score: f64 = quiz_history.iter().filter_map(|item| item.score).sum();
        total_quiz_score / quiz_history.len() as f64
    }
}

fn calculate_material_interaction(history: &[LearningHistoryItem]) -> f64 {
    if history.is_empty() {
        0.0
    } else {
        let total_interaction_score: f64 = history
            .iter()
            .filter_map(|item| item.interaction_score)
            .sum();
        total_interaction_score / history.len() as f64
    }
}

pub async fn extract_user_features(
    user_id: String,
    pool: &Pool<Postgres>,
) -> Result<UserFeatures, sqlx::Error> {
    let user = sqlx::query_as::<_, User>("SELECT id, preferences FROM users WHERE id = $1")
        .bind(&user_id)
        .fetch_optional(pool)
        .await?;

    let user = match user {
        Some(u) => u,
        None => {
            // Return default features if user not found (for new users)
            return Ok(UserFeatures {
                completed_materials: 0,
                average_score: 0.0,
                study_time: 0,
                preferred_categories: Vec::new(),
                last_activity: chrono::Utc::now(),
                difficulty_preference: 0.5,
                learning_style: 0.5,
                engagement_level: 0.0,
                quiz_performance: 0.0,
                material_interaction: 0.0,
            });
        }
    };

    // Query actual tables that exist in the schema
    // Get quiz attempt history
    let quiz_history = sqlx::query_as::<
        _,
        (
            Option<f64>,
            Option<i32>,
            String,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        "SELECT qa.score, qa.time_taken, q.course_id, qa.created_at 
         FROM quiz_attempts qa
         JOIN quizzes q ON qa.quiz_id = q.id
         WHERE qa.user_id = $1
         ORDER BY qa.created_at DESC
         LIMIT 100",
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Get material progress (completed materials)
    let material_progress = sqlx::query_as::<_, (String, i32, String)>(
        "SELECT id, completion_percentage, unit_id FROM material_progress 
         WHERE user_id = $1",
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Get user activities to determine engagement
    let user_activities = sqlx::query_as::<_, (String, String, chrono::DateTime<chrono::Utc>)>(
        "SELECT id, type, created_at FROM user_activities 
         WHERE user_id = $1 
         ORDER BY created_at DESC
         LIMIT 200",
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    // Convert tuples to LearningHistoryItem structs for helper functions
    let history_items: Vec<LearningHistoryItem> = quiz_history
        .iter()
        .enumerate()
        .map(|(idx, (score, duration, category, timestamp))| LearningHistoryItem {
            material_id: format!("material_{}", idx),
            score: *score,
            duration: *duration,
            category: category.clone(),
            timestamp: *timestamp,
            difficulty: None,
            engagement: None,
            item_type: Some("quiz".to_string()),
            interaction_score: None,
        })
        .collect();

    // Add material events (views, downloads, uploads) to history
    let material_events_rows = sqlx::query(
        "SELECT material_id, event_type, view_count, download_count, last_page, last_occurred_at FROM material_events WHERE user_id = $1 ORDER BY last_occurred_at DESC LIMIT 200",
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let mut history_items = history_items;
    for row in material_events_rows {
        let material_id: String = row.try_get("material_id").unwrap_or_default();
        let event_type: String = row.try_get("event_type").unwrap_or_default();
        let view_count: i32 = row.try_get("view_count").unwrap_or(0);
        let download_count: i32 = row.try_get("download_count").unwrap_or(0);
        let _last_page: Option<i32> = row.try_get("last_page").ok();
        let ts: chrono::DateTime<chrono::Utc> = row.try_get("last_occurred_at").unwrap_or(chrono::Utc::now());

        let interaction_score = (view_count as f64 * 0.2 + download_count as f64 * 0.8).min(1.0);
        history_items.push(LearningHistoryItem {
            material_id: material_id.clone(),
            score: None,
            duration: None,
            category: String::new(),
            timestamp: ts,
            difficulty: None,
            engagement: Some(interaction_score as f64),
            item_type: Some(event_type.clone()),
            interaction_score: Some(interaction_score),
        });
    }

    // Add xAPI statements to history, map verbs to interaction strength
    let xapi_rows = sqlx::query("SELECT id, verb, raw, occurred_at FROM xapi_statements WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 200")
        .bind(&user_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
    for row in xapi_rows {
        let verb: String = row.try_get("verb").unwrap_or_else(|_| "unknown".to_string());
        let raw: serde_json::Value = row.try_get("raw").unwrap_or(serde_json::json!({}));
        let occurred_at: chrono::DateTime<chrono::Utc> = row.try_get("occurred_at").unwrap_or(chrono::Utc::now());
        let material_id = raw.get("object").and_then(|o| o.get("id")).and_then(|id| id.as_str()).unwrap_or_default().to_string();
        // Determine interaction impact based on verb
        let interaction_score = if verb.contains("completed") || verb.contains("passed") { 1.0 } else if verb.contains("view") || verb.contains("read") { 0.5 } else { 0.3 };
        history_items.push(LearningHistoryItem {
            material_id: if material_id.is_empty() { format!("xapi_{}", row.try_get::<String, _>("id").unwrap_or_default()) } else { material_id.clone() },
            score: None,
            duration: raw.get("result").and_then(|r| r.get("duration")).and_then(|d| d.as_str()).and_then(|s| humantime::parse_duration(s).ok()).map(|d| (d.as_secs() / 60) as i32),
            category: String::new(),
            timestamp: occurred_at,
            difficulty: None,
            engagement: Some(interaction_score),
            item_type: Some(verb.clone()),
            interaction_score: Some(interaction_score),
        });
    }

    // Use helper functions to calculate metrics
    let completed_materials = material_progress.len() as i32;
    let average_score = calculate_average_score(&history_items);
    let study_time = calculate_total_study_time(&history_items);
    let preferred_categories = extract_preferred_categories(&history_items);
    let last_activity = if !user_activities.is_empty() {
        user_activities.first().map(|(_, _, ts)| *ts).unwrap_or_else(chrono::Utc::now)
    } else if !history_items.is_empty() {
        get_last_activity_date(&history_items)
    } else {
        chrono::Utc::now()
    };

    let difficulty_preference = if !material_progress.is_empty() {
        material_progress
            .iter()
            .map(|(_, completion, _)| *completion as f64 / 100.0)
            .sum::<f64>()
            / material_progress.len() as f64
    } else {
        calculate_difficulty_preference(&history_items)
    };

    let learning_style = determine_learning_style(&user.preferences);
    let engagement_level = if !user_activities.is_empty() {
        (user_activities.len() as f64 / 200.0).min(1.0)
    } else {
        calculate_engagement_level(&history_items)
    };
    let quiz_performance = calculate_quiz_performance(&history_items);
    let material_interaction = calculate_material_interaction(&history_items);

    Ok(UserFeatures {
        completed_materials,
        average_score,
        study_time,
        preferred_categories,
        last_activity,
        difficulty_preference,
        learning_style,
        engagement_level,
        quiz_performance,
        material_interaction,
    })
}
