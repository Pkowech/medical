/// Postgres implementation of MaterialRepository
/// Manages persistence of learning materials and progress
use crate::domain::repositories::{MaterialInfo, MaterialRepository, UnitProgress};
use crate::shared::error::AnalyticsError;
use sqlx::{Pool, Postgres, Row};
use std::sync::Arc;

pub struct PostgresMaterialRepository {
    pool: Arc<Pool<Postgres>>,
}

impl PostgresMaterialRepository {
    pub fn new(pool: Arc<Pool<Postgres>>) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl MaterialRepository for PostgresMaterialRepository {
    async fn get_unit_progress(
        &self,
        user_id: &str,
        unit_id: &str,
    ) -> Result<UnitProgress, AnalyticsError> {
        let row = sqlx::query(
            r#"
            SELECT
                $1::text as user_id,
                $2::text as unit_id,
                COALESCE(
                    (SELECT COUNT(DISTINCT tp.material_id) FROM topic_progress tp
                     JOIN materials m ON tp.material_id = m.id
                     WHERE tp.user_id = $1 AND m.unit_id = $2 AND tp.is_completed = true),
                    0
                ) as completed_count,
                COALESCE(
                    (SELECT COUNT(*) FROM materials m WHERE m.unit_id = $2),
                    0
                ) as total_count,
                COALESCE(
                    (SELECT SUM(material_time.time_spent)
                     FROM (
                         SELECT tp.material_id, MAX(tp.time_spent) as time_spent
                         FROM topic_progress tp
                         JOIN materials m ON tp.material_id = m.id
                         WHERE tp.user_id = $1 AND m.unit_id = $2
                         GROUP BY tp.material_id
                     ) as material_time),
                    0
                ) as time_spent,
                (SELECT MAX(tp.last_accessed_at) FROM topic_progress tp
                 JOIN materials m ON tp.material_id = m.id
                 WHERE tp.user_id = $1 AND m.unit_id = $2) as last_access
            "#,
        )
        .bind(user_id)
        .bind(unit_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch unit progress: {}", e))
        })?;

        let completed_count: i64 = row.try_get("completed_count").unwrap_or(0);
        let total_count: i64 = row.try_get("total_count").unwrap_or(0);
        let time_spent: i64 = row.try_get("time_spent").unwrap_or(0);

        Ok(UnitProgress {
            unit_id: row.try_get("unit_id").unwrap_or_default(),
            completed_count: completed_count.min(i32::MAX as i64) as i32,
            total_count: total_count.min(i32::MAX as i64) as i32,
            time_spent: time_spent.min(i32::MAX as i64) as i32,
            last_access: row
                .try_get("last_access")
                .ok()
                .flatten()
                .map(|dt: chrono::NaiveDateTime| dt.and_utc()),
        })
    }

    async fn get_candidate_materials(
        &self,
        user_id: &str,
        difficulty_range: (f64, f64),
        limit: usize,
    ) -> Result<Vec<MaterialInfo>, AnalyticsError> {
        let rows = sqlx::query(
            r#"
            SELECT
                m.id,
                m.title,
                m.description,
                COALESCE(m.difficulty, 0.5) as difficulty,
                COALESCE(m.tags, ARRAY[]::text[]) as topics
            FROM materials m
            WHERE m.difficulty >= $1 
              AND m.difficulty <= $2
                            AND NOT EXISTS (
                                SELECT 1 FROM topic_progress tp
                                WHERE tp.material_id = m.id AND tp.user_id = $3
              )
            ORDER BY m.difficulty, m.updated_at DESC
            LIMIT $4
            "#,
        )
        .bind(difficulty_range.0)
        .bind(difficulty_range.1)
        .bind(user_id)
        .bind(limit as i64)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch candidate materials: {}", e))
        })?;

        let materials = rows
            .into_iter()
            .map(|row| {
                let id: String = row.try_get("id").unwrap_or_default();
                let title: String = row.try_get("title").unwrap_or_default();
                let description: Option<String> = row.try_get("description").ok();
                let difficulty: f64 = row.try_get("difficulty").unwrap_or(0.5);
                let topics: Vec<String> = row.try_get("topics").unwrap_or_default();

                MaterialInfo {
                    id,
                    title,
                    description,
                    difficulty,
                    topics,
                }
            })
            .collect();

        Ok(materials)
    }

    async fn get_completed_materials(&self, user_id: &str) -> Result<Vec<String>, AnalyticsError> {
        sqlx::query_scalar(
            "SELECT DISTINCT material_id FROM topic_progress WHERE user_id = $1 AND material_id IS NOT NULL AND is_completed = true",
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch completed materials: {}", e))
        })
    }

    async fn get_materials_by_difficulty(
        &self,
        min_difficulty: f64,
        max_difficulty: f64,
        limit: usize,
    ) -> Result<Vec<MaterialInfo>, AnalyticsError> {
        let rows = sqlx::query(
            r#"
            SELECT
                id,
                title,
                description,
                COALESCE(difficulty, 0.5) as difficulty,
                COALESCE(tags, ARRAY[]::text[]) as topics
            FROM materials
            WHERE difficulty >= $1 AND difficulty <= $2
            ORDER BY difficulty
            LIMIT $3
            "#,
        )
        .bind(min_difficulty)
        .bind(max_difficulty)
        .bind(limit as i64)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch materials by difficulty: {}", e))
        })?;

        let materials = rows
            .into_iter()
            .map(|row| MaterialInfo {
                id: row.try_get("id").unwrap_or_default(),
                title: row.try_get("title").unwrap_or_default(),
                description: row.try_get("description").ok(),
                difficulty: row.try_get("difficulty").unwrap_or(0.5),
                topics: row.try_get("topics").unwrap_or_default(),
            })
            .collect();

        Ok(materials)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_get_unit_progress() {
        // Requires test database
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_candidate_materials() {
        // Requires test database
    }
}
