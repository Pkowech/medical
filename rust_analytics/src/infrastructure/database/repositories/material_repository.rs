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
                    (SELECT COUNT(*) FROM material_progress mp
                     JOIN materials m ON mp.material_id = m.id
                     WHERE mp.user_id = $1 AND m.unit_id = $2 AND mp.is_completed = true),
                    0
                ) as completed_count,
                COALESCE(
                    (SELECT COUNT(*) FROM materials m WHERE m.unit_id = $2),
                    0
                ) as total_count,
                COALESCE(
                    (SELECT SUM(time_spent_minutes) FROM material_progress mp
                     JOIN materials m ON mp.material_id = m.id
                     WHERE mp.user_id = $1 AND m.unit_id = $2),
                    0
                ) as time_spent,
                (SELECT MAX(last_accessed_at) FROM material_progress mp
                 JOIN materials m ON mp.material_id = m.id
                 WHERE mp.user_id = $1 AND m.unit_id = $2) as last_access,
                (SELECT concurrent_slot_number FROM unit_progress 
                 WHERE user_id = $1 AND unit_id = $2) as concurrent_slot_number
            "#,
        )
        .bind(user_id)
        .bind(unit_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch unit progress: {}", e))
        })?;

        Ok(UnitProgress {
            unit_id: row.try_get("unit_id").unwrap_or_default(),
            completed_count: row.try_get("completed_count").unwrap_or(0),
            total_count: row.try_get("total_count").unwrap_or(0),
            time_spent: row.try_get("time_spent").unwrap_or(0),
            concurrent_slot_number: row.try_get("concurrent_slot_number").ok(),
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
              AND m.id NOT IN (
                SELECT material_id FROM material_progress WHERE user_id = $3
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
            "SELECT material_id FROM material_progress WHERE user_id = $1 AND is_completed = true",
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
