/// Postgres implementation of ActivityRepository
/// Manages persistence of user activity and engagement metrics
use crate::domain::repositories::ActivityRepository;
use crate::shared::error::AnalyticsError;
use chrono::NaiveDateTime;
use sqlx::{Pool, Postgres, Row};
use std::sync::Arc;

pub struct PostgresActivityRepository {
    pool: Arc<Pool<Postgres>>,
}

impl PostgresActivityRepository {
    pub fn new(pool: Arc<Pool<Postgres>>) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl ActivityRepository for PostgresActivityRepository {
    async fn get_user_activities(
        &self,
        user_id: &str,
    ) -> Result<Vec<NaiveDateTime>, AnalyticsError> {
        let mut activities: Vec<NaiveDateTime> = Vec::new();

        // Get course progress activities
        if let Ok(rows) = sqlx::query_scalar::<_, NaiveDateTime>(
            "SELECT last_accessed_at FROM course_progress WHERE user_id = $1 ORDER BY last_accessed_at DESC LIMIT 100"
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await {
            activities.extend(rows);
        }

        // Get learning path activities
        if let Ok(rows) = sqlx::query_scalar::<_, NaiveDateTime>(
            "SELECT last_activity_date FROM learning_path_progress WHERE user_id = $1 ORDER BY last_activity_date DESC LIMIT 100"
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await {
            activities.extend(rows);
        }

        // Get material progress activities
        if let Ok(rows) = sqlx::query_scalar::<_, NaiveDateTime>(
            "SELECT last_accessed_at FROM material_progress WHERE user_id = $1 ORDER BY last_accessed_at DESC LIMIT 100"
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await {
            activities.extend(rows);
        }

        // Sort descending by time
        activities.sort_by(|a, b| b.cmp(a));
        activities.dedup();

        Ok(activities)
    }

    async fn get_course_completion_stats(
        &self,
        user_id: &str,
    ) -> Result<(i32, i32), AnalyticsError> {
        let total: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM course_progress WHERE user_id = $1")
                .bind(user_id)
                .fetch_one(&*self.pool)
                .await
                .unwrap_or(0);

        let completed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM course_progress WHERE user_id = $1 AND status::text = 'completed'"
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        Ok((total as i32, completed as i32))
    }

    async fn get_learning_path_completion_stats(
        &self,
        user_id: &str,
    ) -> Result<(i32, i32), AnalyticsError> {
        let total: i64 =
            sqlx::query_scalar("SELECT COUNT(*) FROM learning_path_progress WHERE user_id = $1")
                .bind(user_id)
                .fetch_one(&*self.pool)
                .await
                .unwrap_or(0);

        let completed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM learning_path_progress WHERE user_id = $1 AND status::text = 'completed'"
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        Ok((total as i32, completed as i32))
    }

    async fn get_last_activity_date(
        &self,
        user_id: &str,
    ) -> Result<Option<NaiveDateTime>, AnalyticsError> {
        let result = sqlx::query_scalar(
            r#"
            SELECT GREATEST(
                MAX(last_accessed_at),
                MAX(last_activity_date)
            )
            FROM (
                SELECT last_accessed_at FROM course_progress WHERE user_id = $1
                UNION ALL
                SELECT last_activity_date FROM learning_path_progress WHERE user_id = $1
            ) AS activities
            "#,
        )
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch last activity date: {}", e))
        })?;

        Ok(result.flatten())
    }

    async fn get_most_active_hour(&self, user_id: &str) -> Result<Option<i32>, AnalyticsError> {
        sqlx::query_scalar(
            r#"
            SELECT CAST(EXTRACT(HOUR FROM last_accessed_at) AS INT)
            FROM course_progress
            WHERE user_id = $1
            GROUP BY EXTRACT(HOUR FROM last_accessed_at)
            ORDER BY COUNT(*) DESC
            LIMIT 1
            "#,
        )
        .bind(user_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch most active hour: {}", e))
        })
    }

    async fn get_active_unit_slots(
        &self,
        user_id: &str,
    ) -> Result<Vec<(String, i32)>, AnalyticsError> {
        let rows = sqlx::query(
            "SELECT unit_id, concurrent_slot_number 
             FROM unit_progress 
             WHERE user_id = $1 AND concurrent_slot_number IS NOT NULL",
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch active unit slots: {}", e))
        })?;

        let slots = rows
            .into_iter()
            .map(|row| {
                let unit_id: String = row.try_get("unit_id").unwrap_or_default();
                let slot: i32 = row.try_get("concurrent_slot_number").unwrap_or(0);
                (unit_id, slot)
            })
            .collect();

        Ok(slots)
    }

    async fn get_topic_mastery_stats(&self, user_id: &str) -> Result<(i32, i32), AnalyticsError> {
        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM progress WHERE user_id = $1 AND topic_id IS NOT NULL",
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        let mastered: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM progress WHERE user_id = $1 AND topic_id IS NOT NULL AND mastery_unlocked = true"
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        Ok((total as i32, mastered as i32))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_get_user_activities() {
        // Requires test database
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_course_completion_stats() {
        // Requires test database
    }
}
