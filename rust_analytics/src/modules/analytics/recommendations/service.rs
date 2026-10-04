use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres, Row};
use std::collections::HashMap;
use crate::config::AppConfig;
use crate::observability::metrics as obs_metrics;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Recommendation {
    pub path_id: String,
    pub title: String,
    pub description: String,
    pub score: f64,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendingPath {
    pub path_id: String,
    pub enrollments: i64,
}

#[derive(Debug, Clone)]
pub struct UserProfile {
    #[allow(dead_code)]
    pub user_id: String,
    pub completed_paths: usize,
    pub average_score: f64,
    #[allow(dead_code)]
    pub study_time_minutes: i32,
    pub preferred_difficulty: String,
    #[allow(dead_code)]
    pub learning_style: String,
    pub strengths: Vec<String>,
    pub weaknesses: Vec<String>,
    pub recent_topics: Vec<String>,
}

#[derive(Debug, Clone)]
struct LearningPathCandidate {
    id: String,
    title: String,
    description: Option<String>,
    difficulty: String,
    topics: Vec<String>,
}

#[derive(Debug, Clone)]
struct LearningPathScore {
    path_id: String,
    title: String,
    description: String,
    difficulty_match: f64,
    topic_relevance: f64,
    ability_match: f64,
}

/// Get AI-based personalized recommendations for a user
/// Production implementation with database queries and scoring algorithm
pub async fn get_recommendations_ai(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<Vec<Recommendation>, String> {
    // Step 1: Build comprehensive user profile
    let profile = build_user_profile(user_id, pool).await?;

    // Step 2: Get published learning paths the user has not started.
    let candidates = get_candidate_paths(user_id, pool).await?;

    // Step 3: Score each learning path against this user's strengths, gaps, and level.
    let mut scored_paths: Vec<LearningPathScore> = candidates
        .into_iter()
        .map(|path| score_learning_path(path, &profile))
        .collect();

    // Step 4: Rank by the user's personalized fit.
    scored_paths.sort_by(|a, b| {
        let score_a = calculate_final_score(a);
        let score_b = calculate_final_score(b);
        score_b
            .partial_cmp(&score_a)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    // Step 5: Return actual learning path IDs and metadata to the API.
    let recommendations: Vec<Recommendation> = scored_paths
        .into_iter()
        .take(10)
        .map(|path| {
            let final_score = calculate_final_score(&path);
            let reason = generate_recommendation_reason(&path, &profile);
            Recommendation {
                path_id: path.path_id,
                title: path.title,
                description: path.description.unwrap_or_default(),
                score: final_score,
                reason,
            }
        })
        .collect();

    Ok(recommendations)
}

/// Build comprehensive user profile from database
async fn build_user_profile(user_id: &str, pool: &Pool<Postgres>) -> Result<UserProfile, String> {
    // Query user learning analytics
    let analytics = sqlx::query!(
        r#"
        SELECT 
            "totalStudyTime" as "total_study_time!",
            "averageScore" as "average_score!",
            "strongestSubjects" as "strongest_subjects",
            "weakestSubjects" as "weakest_subjects"
        FROM user_learning_analytics
        WHERE "userId" = $1
        "#,
        user_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to fetch user analytics: {}", e))?;

    // Count completed learning paths for profile metadata.
    let completed_count = sqlx::query_scalar!(
        r#"
        SELECT COUNT(*)::int as "count!"
        FROM learning_path_progress
        WHERE user_id = $1 AND status = 'completed'
        "#,
        user_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to count completed paths: {}", e))?;

    // Query recent quiz attempts for topics
    // Query from questions via quiz_questions join
    let recent_topics_raw: Vec<Option<String>> = sqlx::query_scalar!(
        r#"
        WITH topic_list AS (
            SELECT DISTINCT UNNEST(q.tags) as topic, qa.started_at
            FROM quiz_attempts qa
            JOIN quizzes qz ON qa.quiz_id = qz.id
            JOIN quiz_questions qq ON qz.id = qq.quiz_id
            JOIN questions q ON qq.question_id = q.id
            WHERE qa.user_id = $1
            AND array_length(q.tags, 1) > 0
        )
        SELECT topic FROM topic_list ORDER BY started_at DESC LIMIT 20
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    let recent_topics: Vec<String> = recent_topics_raw.into_iter().filter_map(|t| t).collect();

    // Extract profile data
    let (avg_score, study_time, mut strengths, mut weaknesses) = if let Some(a) = analytics {
        (
            a.average_score as f64,
            a.total_study_time,
            a.strongest_subjects.unwrap_or_default(),
            a.weakest_subjects.unwrap_or_default(),
        )
    } else {
        (0.0, 0, vec![], vec![])
    };

    // Try to get BKT-derived skill states (p_known) from user_skill_states and prefer them
    // for strengths/weaknesses if available.
    let bkt_rows = sqlx::query!(
        r#"
        SELECT t.name as "topic_name!", uss.p_known as "p_known!"
        FROM user_skill_states uss
        JOIN topics t ON uss.skill_id = t.id
        WHERE uss.user_id = $1
        ORDER BY uss.p_known DESC
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    if !bkt_rows.is_empty() {
        obs_metrics::inc_bkt_gaps_derived();
        let mut bkt_strengths: Vec<String> = Vec::new();
        let mut bkt_weaknesses: Vec<String> = Vec::new();

        for row in bkt_rows.iter() {
            let name = row.topic_name.clone();
            let p = row.p_known;
            // Mark strengths when probability is high
            let strength_threshold = AppConfig::from_env()
                .map(|c| c.bkt_strength_threshold)
                .unwrap_or(0.75);
            let weakness_threshold = AppConfig::from_env()
                .map(|c| c.bkt_weakness_threshold)
                .unwrap_or(0.6);

            if p >= strength_threshold {
                bkt_strengths.push(name.clone());
            }
            // Mark weaknesses when probability is low or uncertain
            if p <= weakness_threshold {
                bkt_weaknesses.push(name.clone());
            }
        }

        // If BKT provided helpful lists, prefer them (limit to top 5)
        if !bkt_strengths.is_empty() {
            strengths = bkt_strengths.into_iter().take(5).collect();
        }
        if !bkt_weaknesses.is_empty() {
            weaknesses = bkt_weaknesses.into_iter().take(5).collect();
        }
    }

    // Infer difficulty preference based on performance
    let preferred_difficulty = if avg_score >= 85.0 {
        "advanced".to_string()
    } else if avg_score >= 70.0 {
        "intermediate".to_string()
    } else {
        "beginner".to_string()
    };

    // Infer learning style based on activity patterns
    let learning_style = infer_learning_style(user_id, pool)
        .await
        .unwrap_or_else(|_| "visual".to_string());

    Ok(UserProfile {
        user_id: user_id.to_string(),
        completed_paths: completed_count as usize,
        average_score: avg_score,
        study_time_minutes: study_time,
        preferred_difficulty,
        learning_style,
        strengths,
        weaknesses,
        recent_topics,
    })
}

/// Get published, unstarted learning paths to personalize recommendations from.
async fn get_candidate_paths(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<Vec<LearningPathCandidate>, String> {
    let rows = sqlx::query(
        r#"
        SELECT
            lp.id,
            lp.title,
            lp.description,
            lp.difficulty::text AS difficulty,
            lp.path_structure
        FROM learning_paths lp
        WHERE lp.status = 'published'
        AND NOT EXISTS (
            SELECT 1 FROM learning_path_progress lpp
            WHERE lpp.learning_path_id = lp.id
            AND lpp.user_id = $1
        )
        ORDER BY lp.title
        LIMIT 100
        "#
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch candidate learning paths: {}", e))?;

    let candidates = rows
        .into_iter()
        .map(|row| {
            let title: String = row.try_get("title").unwrap_or_default();
            let description: Option<String> = row.try_get("description").ok();
            let path_structure: Option<serde_json::Value> =
                row.try_get("path_structure").unwrap_or(None);
            let mut topics = extract_topics_from_structure(&path_structure);
            topics.push(title.clone());
            if let Some(description) = description.as_deref() {
                topics.push(description.to_string());
            }

            LearningPathCandidate {
                id: row.try_get("id").unwrap_or_default(),
                title,
                description,
                difficulty: row.try_get("difficulty").unwrap_or_default(),
                topics,
            }
        })
        .collect();

    Ok(candidates)
}

/// Score a learning path using the learner's ability and demonstrated topic needs.
fn score_learning_path(path: LearningPathCandidate, profile: &UserProfile) -> LearningPathScore {
    let difficulty_match = match (profile.preferred_difficulty.as_str(), path.difficulty.as_str()) {
        ("beginner", "beginner") => 1.0,
        ("intermediate", "intermediate") => 1.0,
        ("advanced", "advanced") => 1.0,
        ("intermediate", "beginner") => 0.6,
        ("advanced", "intermediate") => 0.8,
        ("advanced", "beginner") => 0.3,
        _ => 0.5,
    };

    let topic_relevance = calculate_topic_relevance(&path.topics, profile);
    let ability_match = (profile.average_score / 100.0).clamp(0.0, 1.0);

    LearningPathScore {
        path_id: path.id,
        title: path.title,
        description: path.description,
        difficulty_match,
        topic_relevance,
        ability_match,
    }
}

/// Calculate topic relevance score
fn calculate_topic_relevance(topics: &[String], profile: &UserProfile) -> f64 {
    if topics.is_empty() {
        return 0.5;
    }

    let mut relevance = 0.0;
    let mut matches = 0;

    // Higher score for topics in weaknesses (need improvement)
    for topic in topics {
        if profile.weaknesses.iter().any(|w| topics_match(w, topic)) {
            relevance += 0.9;
            matches += 1;
        } else if profile.recent_topics.iter().any(|r| topics_match(r, topic)) {
            relevance += 0.6;
            matches += 1;
        } else if profile.strengths.iter().any(|s| topics_match(s, topic)) {
            relevance += 0.3; // Lower priority for strengths
            matches += 1;
        }
    }

    if matches > 0 {
        relevance / matches as f64
    } else {
        0.4 // Neutral for new topics
    }
}

fn topics_match(profile_topic: &str, path_topic: &str) -> bool {
    let profile_topic = profile_topic.trim().to_lowercase();
    let path_topic = path_topic.trim().to_lowercase();
    if profile_topic.is_empty() || path_topic.is_empty() {
        return false;
    }
    profile_topic.contains(&path_topic) || path_topic.contains(&profile_topic)
}

/// Combine user-level difficulty fit, topic relevance, and performance into one score.
fn calculate_final_score(path: &LearningPathScore) -> f64 {
    path.difficulty_match * 0.4
        + path.topic_relevance * 0.5
        + path.ability_match * 0.1
}

/// Generate human-readable reason for recommendation
fn generate_recommendation_reason(path: &LearningPathScore, profile: &UserProfile) -> String {
    let mut reasons = Vec::new();

    if path.difficulty_match > 0.8 {
        reasons.push(format!(
            "Perfect match for your {} level",
            profile.preferred_difficulty
        ));
    }

    if path.topic_relevance > 0.7 {
        reasons.push("Addresses your identified learning gaps".to_string());
    } else if path.topic_relevance > 0.5 {
        reasons.push("Aligns with your recent study topics".to_string());
    }

    if path.ability_match > 0.8 && path.difficulty_match > 0.7 {
        reasons.push("Suitable for your demonstrated performance level".to_string());
    }

    if reasons.is_empty() {
        "Suggested for continued learning progression".to_string()
    } else {
        reasons.join("; ")
    }
}

/// Infer learning style from user activity
async fn infer_learning_style(user_id: &str, pool: &Pool<Postgres>) -> Result<String, String> {
    // Query user activity patterns
    let activity_counts = sqlx::query!(
        r#"
        SELECT 
            type::text as "type",
            COUNT(*)::int as "count!"
        FROM user_activities
        WHERE user_id = $1
        GROUP BY type
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch activity: {}", e))?;

    let mut counts: HashMap<String, i32> = HashMap::new();
    for record in activity_counts {
        if let Some(t) = record.r#type {
            counts.insert(t, record.count);
        }
    }

    // Heuristic: video_watched -> visual, quiz_attempted -> reading, etc.
    let video_count = counts.get("video_watched").unwrap_or(&0);
    let quiz_count = counts.get("quiz_attempted").unwrap_or(&0);
    let case_count = counts.get("case_studied").unwrap_or(&0);

    if case_count > video_count && case_count > quiz_count {
        Ok("kinesthetic".to_string())
    } else if video_count > quiz_count {
        Ok("visual".to_string())
    } else {
        Ok("reading_writing".to_string())
    }
}

/// Extract topics from path structure JSON
fn extract_topics_from_structure(structure: &Option<serde_json::Value>) -> Vec<String> {
    if let Some(serde_json::Value::Object(map)) = structure {
        if let Some(serde_json::Value::Array(topics)) = map.get("topics") {
            return topics
                .iter()
                .filter_map(|t| t.as_str().map(|s| s.to_string()))
                .collect();
        }
    }
    vec![]
}

#[allow(dead_code)]
pub async fn get_recommendations_for_gaps(
    user_id: &str,
    gaps: &[String],
    pool: &Pool<Postgres>,
) -> Result<Vec<Recommendation>, String> {
    if gaps.is_empty() {
        return Ok(Vec::new());
    }

    // Query learning paths that cover the identified gaps
    let mut recommendations = Vec::new();

    for (idx, gap) in gaps.iter().enumerate() {
        // Search for paths with matching topics/tags
        let paths = sqlx::query!(
            r#"
            SELECT id, title, difficulty::text as "difficulty!"
            FROM learning_paths
            WHERE status = 'published'
            AND (
                title ILIKE $1
                OR description ILIKE $1
            )
            AND NOT EXISTS (
                SELECT 1 FROM learning_path_progress lpp
                WHERE lpp.learning_path_id = learning_paths.id
                AND lpp.user_id = $2
            )
            LIMIT 2
            "#,
            format!("%{}%", gap),
            user_id
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        for path in paths {
            let score = 0.95 - (idx as f64 * 0.05);
            recommendations.push(Recommendation {
                path_id: path.id,
                title: path.title,
                description: path.description.unwrap_or_default(),
                score,
                reason: format!("Directly addresses your gap in: {}", gap),
            });
        }
    }

    Ok(recommendations)
}

pub async fn get_trending_paths(
    limit: i64,
    pool: &Pool<Postgres>,
) -> Result<Vec<TrendingPath>, String> {
    let thirty_days_ago = (chrono::Utc::now() - chrono::Duration::days(30)).naive_utc();

    let trending = sqlx::query_as!(
        TrendingPath,
        r#"
        SELECT
            learning_path_id as "path_id!",
            COUNT(*) as "enrollments!"
        FROM learning_path_progress
        WHERE
            started_at >= $1
        GROUP BY
            learning_path_id
        ORDER BY
            "enrollments!" DESC
        LIMIT $2
        "#,
        thirty_days_ago,
        limit
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch trending paths: {}", e))?;

    Ok(trending)
}

#[cfg(test)]
mod personalized_path_tests {
    use super::*;

    fn profile_with_weakness(topic: &str) -> UserProfile {
        UserProfile {
            user_id: "learner".to_string(),
            completed_paths: 1,
            average_score: 75.0,
            study_time_minutes: 120,
            preferred_difficulty: "intermediate".to_string(),
            learning_style: "visual".to_string(),
            strengths: vec![],
            weaknesses: vec![topic.to_string()],
            recent_topics: vec![],
        }
    }

    #[test]
    fn prioritizes_paths_that_address_the_learners_gaps() {
        let profile = profile_with_weakness("cardiology");
        let gap_path = score_learning_path(
            LearningPathCandidate {
                id: "path-cardiology".to_string(),
                title: "Cardiology foundations".to_string(),
                description: Some("Core cardiac concepts".to_string()),
                difficulty: "intermediate".to_string(),
                topics: vec!["cardiology".to_string()],
            },
            &profile,
        );
        let unrelated_path = score_learning_path(
            LearningPathCandidate {
                id: "path-neurology".to_string(),
                title: "Neurology foundations".to_string(),
                description: None,
                difficulty: "intermediate".to_string(),
                topics: vec!["neurology".to_string()],
            },
            &profile,
        );

        assert!(calculate_final_score(&gap_path) > calculate_final_score(&unrelated_path));
        assert_eq!(gap_path.path_id, "path-cardiology");
        assert_eq!(gap_path.title, "Cardiology foundations");
        assert_eq!(
            generate_recommendation_reason(&gap_path, &profile),
            "Perfect match for your intermediate level; Addresses your identified learning gaps"
        );
    }

    #[test]
    fn topic_matching_is_case_insensitive_and_rejects_empty_topics() {
        assert!(topics_match("Cardiology", "cardiology foundations"));
        assert!(!topics_match("", "cardiology"));
        assert!(!topics_match("cardiology", ""));
    }
}
