/// Postgres implementation of CourseRepository
/// Manages persistence of course progress and enrollment data
use crate::domain::repositories::{CourseRepository, CourseStats, UnitProgress};
use crate::modules::analytics::progress_tracking::{
    calculate_course_progress, calculate_user_course_progress,
};
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
    async fn get_course_units(
        &self,
        user_id: &str,
        course_id: &str,
    ) -> Result<Vec<UnitProgress>, AnalyticsError> {
        let rows = sqlx::query(
            r#"
            SELECT 
                u.id,
                COALESCE(
                    (SELECT COUNT(DISTINCT tp.material_id) FROM topic_progress tp
                     JOIN materials m ON m.id = tp.material_id
                     WHERE m.unit_id = u.id AND tp.user_id = $1 AND tp.is_completed = true),
                    0
                ) as completed_count,
                COALESCE(
                    (SELECT COUNT(*) FROM materials m 
                     WHERE m.unit_id = u.id),
                    0
                ) as total_count,
                COALESCE(
                    (SELECT SUM(ua.time_spent) FROM unit_accesses ua
                     WHERE ua.unit_id = u.id AND ua.user_id = $1),
                    0
                ) as time_spent,
                (SELECT MAX(accessed_at) FROM unit_accesses ua
                 WHERE ua.unit_id = u.id AND ua.user_id = $1) as last_access
            FROM units u
            WHERE u.course_id = $2
            "#,
        )
        .bind(user_id)
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
                let completed: i64 = row.try_get("completed_count").unwrap_or(0);
                let total: i64 = row.try_get("total_count").unwrap_or(0);
                let time_spent: i64 = row.try_get("time_spent").unwrap_or(0);
                let last_access: Option<chrono::NaiveDateTime> = row.try_get("last_access").ok();
                UnitProgress {
                    unit_id,
                    completed_count: completed.min(i32::MAX as i64) as i32,
                    total_count: total.min(i32::MAX as i64) as i32,
                    time_spent: time_spent.min(i32::MAX as i64) as i32,
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
        let is_enrolled: bool = sqlx::query_scalar(
            "SELECT EXISTS(
                SELECT 1 FROM course_enrollments
                WHERE user_id = $1
                  AND course_id = $2
                  AND status::text NOT IN ('dropped', 'DROPPED')
            )",
        )
        .bind(user_id)
        .bind(course_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to check course enrollment: {}", e))
        })?;

        let (completed_courses, average_course_progress) = if is_enrolled {
            let progress = calculate_course_progress(&self.pool, user_id, course_id)
                .await
                .map_err(|error| {
                    AnalyticsError::DatabaseError(format!(
                        "Failed to calculate canonical course progress: {error}"
                    ))
                })?;
            (
                if progress.progress_percentage >= 100 {
                    1
                } else {
                    0
                },
                progress.progress_percentage as f32,
            )
        } else {
            (0, 0.0)
        };
        let total_time: i64 = sqlx::query_scalar(
            r#"
            SELECT COALESCE(SUM(ss.duration), 0)::bigint
            FROM study_sessions ss
            LEFT JOIN topics t ON t.id = ss.topic_id
            LEFT JOIN materials m ON m.id = ss.material_id
            JOIN units u ON u.id = COALESCE(t.unit_id, m.unit_id)
            WHERE ss.user_id = $1
              AND u.course_id = $2
              AND ss.is_valid = true
              AND ss.end_time IS NOT NULL
            "#,
        )
        .bind(user_id)
        .bind(course_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch study time: {}", e))
        })?;

        Ok(CourseStats {
            total_courses: if is_enrolled { 1 } else { 0 },
            completed_courses,
            total_study_time_minutes: total_time.min(i32::MAX as i64) as i32,
            average_course_progress,
        })
    }

    async fn count_completed_courses(&self, user_id: &str) -> Result<i32, AnalyticsError> {
        let progress = calculate_user_course_progress(&self.pool, user_id)
            .await
            .map_err(|e| {
                AnalyticsError::DatabaseError(format!(
                    "Failed to calculate canonical course completion: {e}"
                ))
            })?;
        i32::try_from(progress.iter().filter(|(_, percentage)| *percentage >= 100).count())
            .map_err(|e| {
                AnalyticsError::DatabaseError(format!("Completed course count exceeds i32: {e}"))
            })
    }

    async fn count_total_courses(&self, user_id: &str) -> Result<i32, AnalyticsError> {
        let progress = calculate_user_course_progress(&self.pool, user_id)
            .await
            .map_err(|e| {
                AnalyticsError::DatabaseError(format!(
                    "Failed to calculate canonical enrolled courses: {e}"
                ))
            })?;
        i32::try_from(progress.len()).map_err(|e| {
            AnalyticsError::DatabaseError(format!("Course count exceeds i32: {e}"))
        })
    }
}

#[cfg(test)]
mod tests {
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
