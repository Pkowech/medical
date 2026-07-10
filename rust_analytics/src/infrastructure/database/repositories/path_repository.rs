/// Postgres implementation of PathRepository
/// Manages persistence of learning path data

use crate::domain::repositories::PathRepository;
use crate::domain::models::{LearningPath, PathProgress, PathUnit, RecommendedPath};
use crate::shared::error::AnalyticsError;
use sqlx::{Pool, Postgres, Row};
use std::sync::Arc;

pub struct PostgresPathRepository {
    pool: Arc<Pool<Postgres>>,
}

impl PostgresPathRepository {
    pub fn new(pool: Arc<Pool<Postgres>>) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl PathRepository for PostgresPathRepository {
    async fn get_learning_paths(
        &self,
        user_id: &str,
    ) -> Result<Vec<LearningPath>, AnalyticsError> {
        let rows = sqlx::query(
            r#"
            SELECT
                lp.id,
                lp.title,
                lp.description,
                lp.difficulty::text as difficulty,
                lp.estimated_hours,
                lp.created_at,
                lpp.status::text as status,
                lpp.overall_progress_percentage as progress_percentage
            FROM learning_paths lp
            LEFT JOIN learning_path_progress lpp ON lp.id = lpp.learning_path_id AND lpp.user_id = $1
            ORDER BY lp.title
            "#
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(
            format!("Failed to fetch learning paths: {}", e)
        ))?;

        let paths = rows
            .into_iter()
            .map(|row| {
                LearningPath {
                    id: row.try_get("id").unwrap_or_default(),
                    name: row.try_get("title").unwrap_or_default(), // Prisma uses title, not name
                    title: row.try_get("title").unwrap_or_default(),
                    description: row.try_get("description").ok(),
                    difficulty: row.try_get("difficulty").ok(),
                    estimated_time_hours: row.try_get("estimated_hours").ok(),
                    tags: None, // Prisma schema doesn't have tags on learning_paths
                    total_phases: 0, // Not in Prisma schema, using default
                    created_at: row.try_get("created_at").unwrap_or_else(|_| chrono::Local::now().naive_local()),
                    progress: row.try_get("progress_percentage").ok(),
                }
            })
            .collect();

        Ok(paths)
    }

    async fn get_path_progress(
        &self,
        user_id: &str,
        path_id: &str,
    ) -> Result<Option<PathProgress>, AnalyticsError> {
        let row = sqlx::query(
            r#"
            SELECT
                user_id,
                learning_path_id,
                status::text as status,
                total_time_spent_minutes,
                overall_progress_percentage,
                last_activity_date
            FROM learning_path_progress
            WHERE user_id = $1 AND learning_path_id = $2
            "#
        )
        .bind(user_id)
        .bind(path_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(
            format!("Failed to fetch path progress: {}", e)
        ))?;

        Ok(row.map(|row| PathProgress {
            user_id: row.try_get("user_id").unwrap_or_default(),
            path_id: row.try_get("learning_path_id").unwrap_or_default(),
            status: row.try_get("status").unwrap_or_default(),
            total_time_spent_minutes: row.try_get("total_time_spent_minutes").unwrap_or(0),
            overall_progress_percentage: row.try_get("overall_progress_percentage").unwrap_or(0.0),
            last_activity_date: row.try_get("last_activity_date").unwrap_or_else(|_| chrono::Local::now().naive_local()),
            category_id: None, // Not in SELECT, using default
            phase_progress: None,
            current_unit_id: None, // Not in Prisma schema
            completed_units_count: None, // Not in Prisma schema
            progress_percentage: row.try_get("overall_progress_percentage").ok(),
        }))
    }

    async fn update_path_progress(
        &self,
        user_id: &str,
        path_id: &str,
        progress_percentage: f64,
        status: &str,
    ) -> Result<(), AnalyticsError> {
        sqlx::query(
            r#"
            INSERT INTO learning_path_progress
                (user_id, learning_path_id, overall_progress_percentage, status)
            VALUES ($1, $2, $3, $4::"ProgressStatus")
            ON CONFLICT (user_id, learning_path_id)
            DO UPDATE SET
                overall_progress_percentage = $3,
                status = $4::"ProgressStatus",
                last_activity_date = NOW()
            "#
        )
        .bind(user_id)
        .bind(path_id)
        .bind(progress_percentage)
        .bind(status)
        .execute(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(
            format!("Failed to update path progress: {}", e)
        ))?;

        Ok(())
    }

    async fn get_path_units(&self, path_id: &str) -> Result<Vec<PathUnit>, AnalyticsError> {
        let rows = sqlx::query(
            r#"
            SELECT
                id,
                path_id,
                unit_type::text as unit_type,
                unit_reference_id,
                title,
                description,
                "order"
            FROM path_units
            WHERE path_id = $1
            ORDER BY "order"
            "#
        )
        .bind(path_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(
            format!("Failed to fetch path units: {}", e)
        ))?;

        let units = rows
            .into_iter()
            .map(|row| {
                PathUnit {
                    id: row.try_get("id").unwrap_or_default(),
                    path_id: row.try_get("path_id").unwrap_or_default(),
                    title: row.try_get("title").unwrap_or_default(),
                    order_index: row.try_get("order_index").unwrap_or(0),
                    unit_type: row.try_get("unit_type").ok(),
                    unit_reference_id: row.try_get("unit_reference_id").ok(),
                    description: row.try_get("description").ok(),
                    order: row.try_get("order").ok(),
                }
            })
            .collect();

        Ok(units)
    }

    async fn get_recommended_paths(&self, user_id: &str, limit: i32) -> Result<Vec<RecommendedPath>, AnalyticsError> {
        let rows = sqlx::query(
            r#"
            SELECT
                lp.id,
                lp.name,
                lp.description,
                lp.difficulty,
                lp.estimated_time_hours,
                lp.tags,
                r.score
            FROM recommended_learning_paths r
            JOIN learning_paths lp ON r.path_id = lp.id
            WHERE r.user_id = $1
            ORDER BY r.score DESC
            LIMIT $2
            "#
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(
            format!("Failed to fetch recommended paths: {}", e)
        ))?;

        let recommendations = rows
            .into_iter()
            .map(|row| {
                RecommendedPath {
                    id: row.try_get("id").unwrap_or_default(),
                    path_id: row.try_get("path_id").unwrap_or_default(),
                    name: row.try_get("name").unwrap_or_default(),
                    title: row.try_get("title").unwrap_or_default(),
                    description: row.try_get("description").ok(),
                    difficulty: row.try_get("difficulty").ok(),
                    estimated_time_hours: row.try_get("estimated_time_hours").ok(),
                    tags: row.try_get("tags").ok(),
                    recommended_score: row.try_get("score").unwrap_or(0.0),
                    score: row.try_get("score").ok(),
                    reason: row.try_get("reason").unwrap_or_else(|_| "Recommended for you".to_string()),
                }
            })
            .collect();

        Ok(recommendations)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // use crate::test_utils::setup_test_db;

    #[tokio::test]
    #[ignore] // Requires a running Postgres instance for integration testing
    async fn test_get_learning_paths() {
        // let pool = setup_test_db().await;
        // let repo = PostgresPathRepository::new(pool.clone());
        // let user_id = "test_user_path_1";

        // // Insert some test data directly into the database if needed

        // let paths = repo.get_learning_paths(user_id).await.unwrap();
        // assert!(!paths.is_empty());
        // // Further assertions on content
    }

    #[tokio::test]
    #[ignore]
    async fn test_update_and_get_path_progress() {
        // let pool = setup_test_db().await;
        // let repo = PostgresPathRepository::new(pool.clone());
        // let user_id = "test_user_path_2";
        // let path_id = "path_xyz";

        // // Initial update
        // repo.update_path_progress(user_id, path_id, Some("unit_1".to_string()), 1, 25.0, "in_progress").await.unwrap();
        // let progress = repo.get_path_progress(user_id, path_id).await.unwrap().unwrap();
        // assert_eq!(progress.progress_percentage, 25.0);

        // // Update again
        // repo.update_path_progress(user_id, path_id, Some("unit_2".to_string()), 2, 50.0, "in_progress").await.unwrap();
        // let progress = repo.get_path_progress(user_id, path_id).await.unwrap().unwrap();
        // assert_eq!(progress.progress_percentage, 50.0);
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_path_units() {
        // let pool = setup_test_db().await;
        // let repo = PostgresPathRepository::new(pool.clone());
        // let path_id = "path_abc";

        // // Insert path units

        // let units = repo.get_path_units(path_id).await.unwrap();
        // assert!(!units.is_empty());
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_recommended_paths() {
        // let pool = setup_test_db().await;
        // let repo = PostgresPathRepository::new(pool.clone());
        // let user_id = "test_user_path_3";

        // // Insert recommended paths

        // let recommendations = repo.get_recommended_paths(user_id, 5).await.unwrap();
        // assert!(!recommendations.is_empty());
    }
}

