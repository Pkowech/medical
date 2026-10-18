use crate::domain::models::quiz::QuizAttempt;
/// Postgres implementation of QuizRepository
/// Manages persistence of quiz attempts and assessment data
use crate::domain::repositories::QuizRepository;
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
        skill_id: Option<&str>,
        limit: Option<i32>,
        offset: Option<i32>,
    ) -> Result<Vec<QuizAttempt>, AnalyticsError> {
        let mut query_str = "SELECT quiz_id, score, completed_at FROM quiz_attempts \
            WHERE user_id = $1 AND completed_at IS NOT NULL"
            .to_string();
        let mut param_index = 2;
        if skill_id.is_some() {
            query_str.push_str(
                " AND EXISTS (SELECT 1 FROM quiz_questions qq \
                 JOIN questions q ON q.id = qq.question_id \
                 WHERE qq.quiz_id = quiz_attempts.quiz_id AND $2 = ANY(q.topic_ids))",
            );
            param_index += 1;
        }
        query_str.push_str(" ORDER BY completed_at DESC");
        if limit.is_some() {
            query_str.push_str(&format!(" LIMIT ${}", param_index));
            param_index += 1;
        }

        if offset.is_some() {
            query_str.push_str(&format!(" OFFSET ${}", param_index));
        }

        let mut query = sqlx::query(&query_str).bind(user_id);
        if let Some(skill) = skill_id {
            query = query.bind(skill);
        }
        if let Some(l) = limit {
            query = query.bind(l);
        }
        if let Some(o) = offset {
            query = query.bind(o);
        }

        let rows = query.fetch_all(&*self.pool).await.map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch quiz history: {}", e))
        })?;

        let attempts = rows
            .into_iter()
            .map(|row| -> Result<QuizAttempt, AnalyticsError> {
                let quiz_id: String = row.try_get("quiz_id").map_err(|e| {
                    AnalyticsError::DatabaseError(format!("Invalid quiz ID in history: {}", e))
                })?;
                let score: Option<f64> = row.try_get("score").map_err(|e| {
                    AnalyticsError::DatabaseError(format!("Invalid quiz score in history: {}", e))
                })?;
                let completed_at: Option<chrono::NaiveDateTime> =
                    row.try_get("completed_at").map_err(|e| {
                        AnalyticsError::DatabaseError(format!(
                            "Invalid completion time in history: {}",
                            e
                        ))
                    })?;
                let score = score.ok_or_else(|| {
                    AnalyticsError::DatabaseError(format!(
                        "Completed quiz attempt for quiz {} has no score",
                        quiz_id
                    ))
                })?;
                let completed_at = completed_at.ok_or_else(|| {
                    AnalyticsError::DatabaseError(format!(
                        "Completed quiz attempt for quiz {} has no completion time",
                        quiz_id
                    ))
                })?;

                Ok(QuizAttempt {
                    quiz_id,
                    score,
                    date: completed_at.and_utc().to_rfc3339(),
                })
            })
            .collect::<Result<Vec<_>, _>>()?;

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
            INSERT INTO quiz_attempts (
                id, user_id, quiz_id, score, percentage, started_at, completed_at,
                total_questions, correct_answers
            )
            VALUES ($1, $2, $3, $4, $4, NOW(), NOW(), 1, CASE WHEN $5 THEN 1 ELSE 0 END)
            "#,
        )
        .bind(&id)
        .bind(user_id)
        .bind(quiz_id)
        .bind(score)
        .bind(is_correct)
        .execute(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to record quiz attempt: {}", e))
        })?;

        Ok(id)
    }

    async fn get_recent_quiz_performance(
        &self,
        user_id: &str,
        skill_id: &str,
        limit: i64,
    ) -> Result<(i64, i64), AnalyticsError> {
        let row = sqlx::query(
            r#"
            SELECT
                COUNT(*) FILTER (WHERE recent.is_correct) AS correct_count,
                COUNT(*) AS total_count
            FROM (
                SELECT ur.is_correct
                FROM user_responses ur
                JOIN questions q ON q.id = ur.question_id
                WHERE ur.user_id = $1
                  AND $2 = ANY(q.topic_ids)
                ORDER BY ur.created_at DESC
                LIMIT $3
            )
            AS recent
            "#,
        )
        .bind(user_id)
        .bind(skill_id)
        .bind(limit.max(0))
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!(
                "Failed to fetch recent topic performance: {}",
                e
            ))
        })?;
        let correct_count: i64 = row.try_get("correct_count").map_err(|e| {
            AnalyticsError::DatabaseError(format!("Invalid correct-response count: {}", e))
        })?;
        let total_count: i64 = row
            .try_get("total_count")
            .map_err(|e| AnalyticsError::DatabaseError(format!("Invalid response count: {}", e)))?;

        Ok((correct_count, total_count))
    }

    async fn get_average_quiz_score(&self, user_id: &str) -> Result<f32, AnalyticsError> {
        let avg_opt: Option<f64> = sqlx::query_scalar::<_, Option<f64>>(
            "SELECT AVG(CAST(score AS FLOAT)) FROM quiz_attempts WHERE user_id = $1 AND completed_at IS NOT NULL",
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            AnalyticsError::DatabaseError(format!("Failed to fetch average score: {}", e))
        })?;

        let avg = avg_opt.unwrap_or(0.0) as f32;
        Ok(avg)
    }

    async fn count_quiz_attempts(&self, user_id: &str) -> Result<i64, AnalyticsError> {
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM quiz_attempts WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(&*self.pool)
            .await
            .map_err(|e| {
                AnalyticsError::DatabaseError(format!("Failed to count quiz attempts: {}", e))
            })
    }
}

#[cfg(test)]
mod tests {
    // TODO: Add integration tests with test database
    #[tokio::test]
    #[ignore]
    async fn test_get_quiz_attempt_history() {
        // Test would require test database setup
    }
}
