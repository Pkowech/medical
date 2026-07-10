/// Postgres implementation of CourseRepository
/// Manages persistence of course progress and enrollment data
use crate::domain::repositories::{CourseRepository, CourseStats, UnitProgress};
use crate::shared::error::AnalyticsError;
use sqlx::{Pool, Postgres, Row};
use std::sync::Arc;

pub struct PostgresCourseRepository {
    pool: Arc<Pool<Postgres>>,
}

impl PostgresCourseRepository {
    pub fn new(pool: Arc<Pool<Postgres>>) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl CourseRepository for PostgresCourseRepository {
    async fn get_course_units(&self, course_id: &str) -> Result<Vec<UnitProgress>, AnalyticsError> {
        let rows = sqlx::query(
            r#"
            SELECT 
                id,
                COALESCE(
                    (SELECT COUNT(*) FROM materials m 
                     WHERE m.unit_id = u.id AND m.is_completed = true),
                    0
                ) as completed_count,
                COALESCE(
                    (SELECT COUNT(*) FROM materials m 
                     WHERE m.unit_id = u.id),
                    0
                ) as total_count,
                COALESCE(
                    (SELECT SUM(time_spent) FROM unit_access ua 
                     WHERE ua.unit_id = u.id),
                    0
                ) as time_spent,
                (SELECT MAX(accessed_at) FROM unit_access ua 
                 WHERE ua.unit_id = u.id) as last_access
            FROM units u
            WHERE u.course_id = $1
            "#,
        )
        .bind(course_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch course units: {}", e))
        })?;

        let units = rows
            .into_iter()
            .map(|row| {
                let unit_id: String = row.try_get("id").unwrap_or_default();
                let completed: i32 = row.try_get("completed_count").unwrap_or(0);
                let total: i32 = row.try_get("total_count").unwrap_or(0);
                let time_spent: i32 = row.try_get("time_spent").unwrap_or(0);
                let last_access: Option<chrono::NaiveDateTime> = row.try_get("last_access").ok();
                let slot: Option<i32> = row.try_get("concurrent_slot_number").ok();

                UnitProgress {
                    unit_id,
                    completed_count: completed,
                    total_count: total,
                    time_spent,
                    concurrent_slot_number: slot,
                    last_access: last_access.map(|dt| dt.and_utc()),
                }
            })
            .collect();

        Ok(units)
    }

    async fn get_total_course_materials(&self, course_id: &str) -> Result<usize, AnalyticsError> {
        let count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM materials m
            JOIN units u ON m.unit_id = u.id
            WHERE u.course_id = $1
            "#,
        )
        .bind(course_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to count course materials: {}", e))
        })?;

        Ok(count as usize)
    }

    async fn get_course_stats(
        &self,
        user_id: &str,
        course_id: &str,
    ) -> Result<CourseStats, AnalyticsError> {
        let row = sqlx::query(
            r#"
            SELECT
                COUNT(*) as total_courses,
                (SELECT COUNT(*) FROM course_progress 
                 WHERE user_id = $1 AND status::text = 'completed') as completed_courses,
                COALESCE(SUM(time_spent), 0) as total_time,
                COALESCE(AVG(progress_percentage), 0.0) as avg_progress
            FROM course_progress
            WHERE user_id = $1 AND course_id = $2
            "#,
        )
        .bind(user_id)
        .bind(course_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch course stats: {}", e))
        })?;

        Ok(CourseStats {
            total_courses: row.try_get("total_courses").unwrap_or(0),
            completed_courses: row.try_get("completed_courses").unwrap_or(0),
            total_study_time_minutes: row.try_get("total_time").unwrap_or(0),
            average_course_progress: row.try_get::<f64, _>("avg_progress").unwrap_or(0.0) as f32,
        })
    }

    async fn count_completed_courses(&self, user_id: &str) -> Result<i32, AnalyticsError> {
        sqlx::query_scalar::<_, i64>(
            r#"
            SELECT COUNT(*)
            FROM course_progress
            WHERE user_id = $1 AND status::text = 'completed'
            "#,
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to count completed courses: {}", e))
        })
        .map(|count| count as i32)
    }

    async fn count_total_courses(&self, user_id: &str) -> Result<i32, AnalyticsError> {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM course_progress WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&*self.pool)
            .await
            .map_err(|e| {
                AnalyticsError::DatabaseError(format!("Failed to count total courses: {}", e))
            })
            .map(|count| count as i32)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_get_course_units() {
        // Requires test database
    }

    #[tokio::test]
    #[ignore]
    async fn test_count_completed_courses() {
        // Requires test database
    }
}
