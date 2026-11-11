use chrono::{Duration, NaiveDate, NaiveDateTime, Utc};
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

const QUALIFYING_ACTIVITY_TYPES: &str =
    "'LEARNING', 'quiz_attempt', 'study_session', 'flashcard_review', 'flashcard_session'";

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
    let now = Utc::now().naive_utc();
    let activity_count = sqlx::query_scalar::<_, i64>(&format!(
        "SELECT COUNT(*) FROM user_activities
         WHERE user_id = $1
           AND type::text IN ({QUALIFYING_ACTIVITY_TYPES})
           AND created_at > $2"
    ))
    .bind(user_id)
    .bind(now - Duration::days(7))
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to count qualifying learning activity: {e}"))?;

    let weekly_engagement_score = (activity_count as f64 / 50.0).min(1.0);

    let today = Utc::now().date_naive();
    let activity_days = sqlx::query_scalar::<_, NaiveDate>(&format!(
        "SELECT DISTINCT created_at::date
         FROM user_activities
         WHERE user_id = $1
           AND type::text IN ({QUALIFYING_ACTIVITY_TYPES})
           AND created_at::date >= $2
         ORDER BY created_at::date DESC
         LIMIT 366"
    ))
    .bind(user_id)
    .bind(today - Duration::days(366))
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch qualifying learning activity days: {e}"))?;
    let daily_streak = calculate_daily_streak(&activity_days, today);

    let last_activity = sqlx::query_scalar::<_, Option<NaiveDateTime>>(&format!(
        "SELECT MAX(created_at) FROM user_activities
         WHERE user_id = $1
           AND type::text IN ({QUALIFYING_ACTIVITY_TYPES})"
    ))
    .bind(user_id)
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to fetch latest learning activity: {e}"))?
    .map(|dt| dt.format("%Y-%m-%d %H:%M:%S").to_string());

    Ok(UserEngagement {
        user_id: user_id.to_string(),
        weekly_engagement_score,
        daily_active_streak: daily_streak,
        last_activity,
    })
}

fn calculate_daily_streak(activity_days: &[NaiveDate], today: NaiveDate) -> i32 {
    let mut expected_day = if activity_days.contains(&today) {
        today
    } else if let Some(yesterday) = today.pred_opt() {
        yesterday
    } else {
        return 0;
    };

    if !activity_days.contains(&expected_day) {
        return 0;
    }

    let mut streak = 0;
    while activity_days.contains(&expected_day) && streak < 366 {
        streak += 1;
        let Some(previous_day) = expected_day.pred_opt() else {
            break;
        };
        expected_day = previous_day;
    }

    streak
}

#[cfg(test)]
mod tests {
    use super::calculate_daily_streak;
    use chrono::NaiveDate;

    fn day(day: u32) -> NaiveDate {
        NaiveDate::from_ymd_opt(2026, 11, day).unwrap()
    }

    #[test]
    fn accepts_a_streak_ending_today_or_yesterday() {
        assert_eq!(
            calculate_daily_streak(&[day(12), day(11), day(10)], day(12)),
            3
        );
        assert_eq!(calculate_daily_streak(&[day(11), day(10)], day(12)), 2);
    }

    #[test]
    fn breaks_after_a_missed_day_and_ignores_empty_or_old_activity() {
        assert_eq!(calculate_daily_streak(&[day(12), day(10)], day(12)), 1);
        assert_eq!(calculate_daily_streak(&[], day(12)), 0);
        assert_eq!(calculate_daily_streak(&[day(10)], day(12)), 0);
    }
}
