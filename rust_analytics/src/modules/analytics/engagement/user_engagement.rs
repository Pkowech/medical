use chrono::Utc;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Serialize, Deserialize)]
pub struct UserEngagement {
    pub user_id: String,
    pub weekly_engagement_score: f64,
    pub daily_active_streak: i32,
    pub last_activity: Option<String>,
}

pub async fn get_user_engagement(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<UserEngagement, String> {
    let activity_count = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM user_activities 
         WHERE user_id = $1 AND created_at > NOW() - INTERVAL '7 days'",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let weekly_engagement_score = (activity_count as f64 / 50.0).min(1.0);

    let daily_streak = calculate_daily_streak(user_id, pool).await;

    let last_activity = sqlx::query_scalar::<_, chrono::DateTime<Utc>>(
        "SELECT MAX(created_at) FROM user_activities WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten()
    .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string());

    Ok(UserEngagement {
        user_id: user_id.to_string(),
        weekly_engagement_score,
        daily_active_streak: daily_streak,
        last_activity,
    })
}

async fn calculate_daily_streak(user_id: &str, pool: &Pool<Postgres>) -> i32 {
    let mut streak = 0;
    let mut current_date = Utc::now().date_naive();

    loop {
        let has_activity = sqlx::query_scalar::<_, bool>(
            "SELECT EXISTS(
                SELECT 1 FROM user_activities 
                WHERE user_id = $1 
                AND DATE(created_at) = $2
            )",
        )
        .bind(user_id)
        .bind(current_date)
        .fetch_one(pool)
        .await
        .unwrap_or(false);

        if !has_activity {
            break;
        }

        streak += 1;
        current_date = current_date.pred_opt().unwrap_or(current_date);

        if streak > 365 {
            break;
        }
    }

    streak
}
