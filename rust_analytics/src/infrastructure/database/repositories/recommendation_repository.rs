/// Postgres implementation of RecommendationRepository
/// Uses recommendation tables to fetch and persist recommendation scores

use crate::domain::repositories::RecommendationRepository;
use crate::modules::analytics::recommendations::service::Recommendation;
use crate::shared::error::AnalyticsError;
use sqlx::{Pool, Postgres, Row};
use std::sync::Arc;

pub struct PostgresRecommendationRepository {
    pool: Arc<Pool<Postgres>>,
}

impl PostgresRecommendationRepository {
    pub fn new(pool: Arc<Pool<Postgres>>) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl RecommendationRepository for PostgresRecommendationRepository {
    async fn get_recommendations(&self, user_id: &str, limit: usize) -> Result<Vec<Recommendation>, AnalyticsError> {
        let rows = sqlx::query(
            r#"
            SELECT r.item_id, r.score, m.title, m.description
            FROM recommendation_scores r
            JOIN materials m ON r.item_id = m.id
            ORDER BY r.score DESC
            LIMIT $1
            "#
        )
        .bind(limit as i64)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(format!("Failed to fetch recommendations: {}", e)))?;

        let recs = rows
            .into_iter()
            .map(|row| Recommendation {
                material_id: row.try_get("item_id").unwrap_or_default(),
                score: row.try_get::<f64, _>("score").unwrap_or(0.0),
                reason: row.try_get::<String, _>("title").unwrap_or_default(),
            })
            .collect();

        Ok(recs)
    }

    async fn store_recommendation_score(&self, user_id: &str, material_id: &str, score: f64) -> Result<(), AnalyticsError> {
        sqlx::query(
            r#"
            INSERT INTO recommendation_scores (item_id, score, created_at)
            VALUES ($1, $2, NOW())
            ON CONFLICT (item_id)
            DO UPDATE SET score = EXCLUDED.score, created_at = NOW()
            "#
        )
        .bind(material_id)
        .bind(score)
        .execute(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(format!("Failed to store recommendation score: {}", e)))?;

        Ok(())
    }

    async fn get_user_preferences(&self, user_id: &str) -> Result<serde_json::Value, AnalyticsError> {
        let row = sqlx::query("SELECT preferences FROM user_profiles WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AnalyticsError::DatabaseError(format!("Failed to fetch user preferences: {}", e)))?;

        if let Some(r) = row {
            let prefs: Option<serde_json::Value> = r.try_get("preferences").ok();
            Ok(prefs.unwrap_or(serde_json::Value::Null))
        } else {
            Ok(serde_json::Value::Null)
        }
    }
}

