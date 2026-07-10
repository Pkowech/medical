use chrono::NaiveDateTime;
use sqlx::{Error, Pool, Postgres};

use crate::domain::models::quiz::QuizAttempt;

#[derive(Debug, sqlx::FromRow)]
pub struct QuizAttemptDb {
    pub quiz_id: String,
    pub score: Option<f64>,
    pub completed_at: Option<NaiveDateTime>,
}

pub async fn get_quiz_attempt_history(
    user_id: &str,
    limit: Option<i32>,
    offset: Option<i32>,
    pool: &Pool<Postgres>,
) -> Result<Vec<QuizAttempt>, Error> {
    let mut query_string = "SELECT quiz_id, score, completed_at FROM quiz_attempts WHERE user_id = $1 ORDER BY completed_at DESC".to_string();
    if limit.is_some() {
        query_string.push_str(" LIMIT $2");
    }
    if offset.is_some() {
        query_string.push_str(" OFFSET $3");
    }

    let mut query = sqlx::query_as::<_, QuizAttemptDb>(&query_string).bind(user_id);

    if let Some(l) = limit {
        query = query.bind(l);
    }
    if let Some(o) = offset {
        query = query.bind(o);
    }

    let attempts_db = query.fetch_all(pool).await?;

    let attempts = attempts_db
        .into_iter()
        .map(|a| QuizAttempt {
            quiz_id: a.quiz_id,
            score: a.score.unwrap_or_default(),
            date: a
                .completed_at
                .map(|dt| dt.and_utc().to_rfc3339())
                .unwrap_or_default(),
        })
        .collect();

    Ok(attempts)
}
