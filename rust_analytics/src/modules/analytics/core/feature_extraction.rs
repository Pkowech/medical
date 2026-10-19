use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, sqlx::FromRow, Serialize, Deserialize)]
pub struct LearningHistoryItem {
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

#[derive(Debug, Serialize, Deserialize)]
pub struct UserFeatures {
    pub completed_materials: i64,
    pub average_score: f64,
    pub study_time: i64,
    pub preferred_categories: Vec<String>,
    pub difficulty_preference: f64,
    pub learning_style: f64,
    pub engagement_level: f64,
    pub quiz_performance: f64,
    pub material_interaction: f64,
}

#[derive(Debug, sqlx::FromRow)]
struct User {
    preferences: Option<serde_json::Value>,
}

fn preference_value(preferences: &Option<serde_json::Value>, key: &str) -> f64 {
    preferences
        .as_ref()
        .and_then(|value| value.get(key))
        .and_then(serde_json::Value::as_f64)
        .filter(|value| value.is_finite())
        .unwrap_or(0.5)
}

pub async fn extract_user_features(
    user_id: String,
    pool: &Pool<Postgres>,
) -> Result<UserFeatures, sqlx::Error> {
    let user = sqlx::query_as::<_, User>("SELECT preferences FROM users WHERE id = $1")
        .bind(&user_id)
        .fetch_optional(pool)
        .await?
        .ok_or(sqlx::Error::RowNotFound)?;

    let completed_materials: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT material_id)::bigint
         FROM topic_progress
         WHERE user_id = $1
           AND material_id IS NOT NULL
           AND completion_percentage >= 100",
    )
    .bind(&user_id)
    .fetch_one(pool)
    .await?;

    let average_score: f64 = sqlx::query_scalar(
        "SELECT COALESCE(AVG(percentage), 0)::double precision
         FROM quiz_attempts
         WHERE user_id = $1 AND completed_at IS NOT NULL",
    )
    .bind(&user_id)
    .fetch_one(pool)
    .await?;

    let study_time: i64 = sqlx::query_scalar(
        "SELECT COALESCE(SUM(duration), 0)::bigint
         FROM study_sessions
         WHERE user_id = $1
           AND is_valid = TRUE
           AND end_time IS NOT NULL",
    )
    .bind(&user_id)
    .fetch_one(pool)
    .await?;

    let preferred_categories: Vec<String> = sqlx::query_scalar(
        "SELECT DISTINCT COALESCE(category_id, topic_id, unit_id)
         FROM quizzes
         WHERE id IN (
             SELECT DISTINCT quiz_id
             FROM quiz_attempts
             WHERE user_id = $1 AND completed_at IS NOT NULL
         )
           AND COALESCE(category_id, topic_id, unit_id) IS NOT NULL",
    )
    .bind(&user_id)
    .fetch_all(pool)
    .await?;

    let engagement_level: f64 = sqlx::query_scalar(
        "SELECT LEAST(COUNT(*)::double precision / 200.0, 1.0)
         FROM user_activities
         WHERE user_id = $1",
    )
    .bind(&user_id)
    .fetch_one(pool)
    .await?;

    let material_interaction: f64 = sqlx::query_scalar(
        "SELECT COALESCE(
             AVG(LEAST(1.0, view_count * 0.2 + download_count * 0.8)),
             0
         )::double precision
         FROM material_events
         WHERE user_id = $1",
    )
    .bind(&user_id)
    .fetch_one(pool)
    .await?;

    Ok(UserFeatures {
        completed_materials,
        average_score,
        study_time,
        preferred_categories,
        difficulty_preference: preference_value(&user.preferences, "difficultyPreference"),
        learning_style: preference_value(&user.preferences, "learningStyle"),
        engagement_level,
        quiz_performance: average_score,
        material_interaction,
    })
}

#[cfg(test)]
mod tests {
    use super::preference_value;

    #[test]
    fn preference_value_uses_stored_numeric_preference() {
        let preferences = Some(serde_json::json!({"learningStyle": 0.7}));

        assert_eq!(preference_value(&preferences, "learningStyle"), 0.7);
    }

    #[test]
    fn preference_value_uses_neutral_prior_when_unset() {
        assert_eq!(preference_value(&None, "difficultyPreference"), 0.5);
    }
}
