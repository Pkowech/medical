/// Postgres implementation of SkillStateRepository
/// Manages persistence of Bayesian Knowledge Tracing skill states
use crate::domain::repositories::SkillStateRepository;
use crate::shared::error::AnalyticsError;
use sqlx::{Pool, Postgres};
use std::sync::Arc;

pub struct PostgresSkillStateRepository {
    pool: Arc<Pool<Postgres>>,
}

impl PostgresSkillStateRepository {
    pub fn new(pool: Arc<Pool<Postgres>>) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl SkillStateRepository for PostgresSkillStateRepository {
    async fn get_user_skill_state(
        &self,
        user_id: &str,
        skill_id: &str,
    ) -> Result<Option<f64>, AnalyticsError> {
        let result = sqlx::query_scalar::<_, Option<f64>>(
            "SELECT p_known FROM user_skill_states WHERE user_id = $1 AND skill_id = $2",
        )
        .bind(user_id)
        .bind(skill_id)
        .fetch_optional(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch skill state: {}", e))
        })?;

        Ok(result.flatten())
    }

    async fn update_user_skill_state(
        &self,
        user_id: &str,
        skill_id: &str,
        p_known: f64,
    ) -> Result<(), AnalyticsError> {
        sqlx::query(
            r#"
            INSERT INTO user_skill_states (user_id, skill_id, p_known, last_updated, attempts)
            VALUES ($1, $2, $3, NOW(), 0)
            ON CONFLICT (user_id, skill_id)
            DO UPDATE SET
                p_known = $3,
                last_updated = NOW()
            "#,
        )
        .bind(user_id)
        .bind(skill_id)
        .bind(p_known)
        .execute(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to update skill state: {}", e))
        })?;

        Ok(())
    }

    async fn get_all_skill_states(
        &self,
        user_id: &str,
    ) -> Result<Vec<(String, f64)>, AnalyticsError> {
        sqlx::query_as::<_, (String, f64)>(
            "SELECT skill_id, p_known FROM user_skill_states WHERE user_id = $1",
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(format!("Failed to fetch skill states: {}", e)))
    }

    async fn get_weakest_skills(
        &self,
        user_id: &str,
        limit: usize,
    ) -> Result<Vec<(String, f64)>, AnalyticsError> {
        sqlx::query_as::<_, (String, f64)>(
            "SELECT skill_id, p_known FROM user_skill_states 
             WHERE user_id = $1 
             ORDER BY p_known ASC 
             LIMIT $2",
        )
        .bind(user_id)
        .bind(limit as i64)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch weakest skills: {}", e))
        })
    }

    async fn increment_attempts(
        &self,
        user_id: &str,
        skill_id: &str,
    ) -> Result<(), AnalyticsError> {
        sqlx::query(
            "UPDATE user_skill_states 
             SET attempts = attempts + 1, last_updated = NOW()
             WHERE user_id = $1 AND skill_id = $2",
        )
        .bind(user_id)
        .bind(skill_id)
        .execute(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to increment attempts: {}", e))
        })?;

        Ok(())
    }

    async fn update_user_skill_state_once(
        &self,
        event_id: &str,
        user_id: &str,
        skill_id: &str,
        is_correct: bool,
    ) -> Result<(f64, bool, bool), AnalyticsError> {
        let mut transaction = self.pool.begin().await.map_err(|error| {
            AnalyticsError::DatabaseError(format!(
                "Failed to begin idempotent BKT update: {}",
                error
            ))
        })?;

        let inserted = sqlx::query(
            "INSERT INTO processed_bkt_updates (event_id) VALUES ($1) ON CONFLICT DO NOTHING",
        )
        .bind(event_id)
        .execute(&mut *transaction)
        .await
        .map_err(|error| {
            AnalyticsError::DatabaseError(format!("Failed to record BKT event: {}", error))
        })?
        .rows_affected();

        if inserted == 0 {
            let current = sqlx::query_scalar::<_, f64>(
                "SELECT p_known FROM user_skill_states WHERE user_id = $1 AND skill_id = $2",
            )
            .bind(user_id)
            .bind(skill_id)
            .fetch_optional(&mut *transaction)
            .await
            .map_err(|error| {
                AnalyticsError::DatabaseError(format!(
                    "Failed to read duplicate BKT result: {}",
                    error
                ))
            })?;
            transaction.commit().await.map_err(|error| {
                AnalyticsError::DatabaseError(format!(
                    "Failed to finish duplicate BKT request: {}",
                    error
                ))
            })?;
            return Ok((
                current.unwrap_or(
                    crate::modules::analytics::performance::bkt::BKTParams::default().p_init,
                ),
                false,
                false,
            ));
        }

        sqlx::query("SELECT pg_advisory_xact_lock(hashtextextended($1 || ':' || $2, 0))")
            .bind(user_id)
            .bind(skill_id)
            .execute(&mut *transaction)
            .await
            .map_err(|error| {
                AnalyticsError::DatabaseError(format!("Failed to lock BKT skill update: {}", error))
            })?;

        let p_known_prev = sqlx::query_scalar::<_, f64>(
            "SELECT p_known FROM user_skill_states WHERE user_id = $1 AND skill_id = $2",
        )
        .bind(user_id)
        .bind(skill_id)
        .fetch_optional(&mut *transaction)
        .await
        .map_err(|error| {
            AnalyticsError::DatabaseError(format!("Failed to read BKT state for update: {}", error))
        })?
        .unwrap_or(crate::modules::analytics::performance::bkt::BKTParams::default().p_init);
        let p_known = crate::modules::analytics::performance::bkt::update_p_known(
            p_known_prev,
            is_correct,
            &crate::modules::analytics::performance::bkt::BKTParams::default(),
        );

        sqlx::query(
            r#"
            INSERT INTO user_skill_states (user_id, skill_id, p_known, last_updated, attempts)
            VALUES ($1, $2, $3, NOW(), 1)
            ON CONFLICT (user_id, skill_id)
            DO UPDATE SET
                p_known = $3,
                last_updated = NOW(),
                attempts = user_skill_states.attempts + 1
            "#,
        )
        .bind(user_id)
        .bind(skill_id)
        .bind(p_known)
        .execute(&mut *transaction)
        .await
        .map_err(|error| {
            AnalyticsError::DatabaseError(format!(
                "Failed to apply idempotent BKT update: {}",
                error
            ))
        })?;

        transaction.commit().await.map_err(|error| {
            AnalyticsError::DatabaseError(format!("Failed to commit BKT update: {}", error))
        })?;
        Ok((p_known, true, p_known > p_known_prev))
    }
}

#[cfg(test)]
mod tests {
    // TODO: Add integration tests with test database
    #[tokio::test]
    #[ignore]
    async fn test_get_user_skill_state() {
        // Test would require test database setup
    }
}
