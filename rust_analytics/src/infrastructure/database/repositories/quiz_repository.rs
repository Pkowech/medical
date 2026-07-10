/// Postgres implementation of QuizRepository
/// Manages persistence of quiz attempts and assessment data

use crate::domain::repositories::QuizRepository;
use crate::domain::models::quiz::QuizAttempt;
use crate::shared::error::AnalyticsError;
use sqlx::{Pool, Postgres, Row};
use std::sync::Arc;

pub struct PostgresQuizRepository {
    pool: Arc<Pool<Postgres>>,
}

impl PostgresQuizRepository {
    pub fn new(pool: Arc<Pool<Postgres>>) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl QuizRepository for PostgresQuizRepository {
    async fn get_quiz_attempt_history(
        &self,
        user_id: &str,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Result<Vec<QuizAttempt>, AnalyticsError> {
        let mut query_str = 
            "SELECT quiz_id, score, completed_at FROM quiz_attempts WHERE user_id = $1 ORDER BY completed_at DESC".to_string();
        
        let mut param_index = 2;
        
        if limit.is_some() {
            query_str.push_str(&format!(" LIMIT ${}", param_index));
            param_index += 1;
        }
        
        if offset.is_some() {
            query_str.push_str(&format!(" OFFSET ${}", param_index));
        }

        let mut query = sqlx::query(&query_str).bind(user_id);

        if let Some(l) = limit {
            query = query.bind(l);
        }
        if let Some(o) = offset {
            query = query.bind(o);
        }

        let rows = query
            .fetch_all(&*self.pool)
            .await
            .map_err(|e| AnalyticsError::DatabaseError(format!("Failed to fetch quiz history: {}", e)))?;

        let attempts = rows
            .into_iter()
            .map(|row| {
                let quiz_id: String = row.try_get("quiz_id").unwrap_or_default();
                let score: Option<f64> = row.try_get("score").unwrap_or(None);
                let completed_at: Option<chrono::NaiveDateTime> = row.try_get("completed_at").unwrap_or(None);

                QuizAttempt {
                    quiz_id,
                    score: score.unwrap_or(0.0),
                    date: completed_at
                        .map(|dt| dt.and_utc().to_rfc3339())
                        .unwrap_or_default(),
                }
            })
            .collect();

        Ok(attempts)
    }

    async fn record_quiz_attempt(
        &self,
        user_id: &str,
        quiz_id: &str,
        score: f64,
        is_correct: bool,
    ) -> Result<String, AnalyticsError> {
        let id = uuid::Uuid::new_v4().to_string();

        sqlx::query(
            r#"
            INSERT INTO quiz_attempts (id, user_id, quiz_id, score, correct, attempted_at, attempt_date)
            VALUES ($1, $2, $3, $4, $5, NOW(), NOW())
            "#
        )
        .bind(&id)
        .bind(user_id)
        .bind(quiz_id)
        .bind(score)
        .bind(is_correct)
        .execute(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(format!("Failed to record quiz attempt: {}", e)))?;

        Ok(id)
    }

    async fn get_recent_quiz_performance(
        &self,
        user_id: &str,
        skill_id: &str,
        limit: i64,
    ) -> Result<(i64, i64), AnalyticsError> {
        // Get correct count
        let correct_count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM quiz_attempts
            WHERE user_id = $1
            AND question_id IN (
                SELECT id FROM questions WHERE skill_id = $2
            )
            AND correct = true
            ORDER BY attempt_date DESC
            LIMIT $3
            "#
        )
        .bind(user_id)
        .bind(skill_id)
        .bind(limit)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(0);

        // Get total count
        let total_count: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*)
            FROM quiz_attempts
            WHERE user_id = $1
            AND question_id IN (
                SELECT id FROM questions WHERE skill_id = $2
            )
            ORDER BY attempt_date DESC
            LIMIT $3
            "#
        )
        .bind(user_id)
        .bind(skill_id)
        .bind(limit)
        .fetch_one(&*self.pool)
        .await
        .unwrap_or(1);

        Ok((correct_count, total_count))
    }

    async fn get_average_quiz_score(&self, user_id: &str) -> Result<f32, AnalyticsError> {
        let avg_opt: Option<f64> = sqlx::query_scalar::<_, Option<f64>>(
            "SELECT AVG(CAST(score AS FLOAT)) FROM quiz_attempts WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(format!("Failed to fetch average score: {}", e)))?;

        let avg = avg_opt.unwrap_or(0.0) as f32;
        Ok(avg)
    }

    async fn count_quiz_attempts(&self, user_id: &str) -> Result<i64, AnalyticsError> {
        sqlx::query_scalar::<_, i64>(
            "SELECT COUNT(*) FROM quiz_attempts WHERE user_id = $1"
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(format!("Failed to count quiz attempts: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // TODO: Add integration tests with test database
    #[tokio::test]
    #[ignore]
    async fn test_get_quiz_attempt_history() {
        // Test would require test database setup
    }
}

