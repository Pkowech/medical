use chrono::NaiveDateTime;
use sqlx::{Error, Pool, Postgres};

#[derive(Debug, sqlx::FromRow)]
pub struct QuizAttemptHistoryItem {
    pub attempt_id: String,
    pub quiz_id: String,
    pub score: f64,
    pub date: Option<NaiveDateTime>,
    pub total_questions: i32,
    pub correct_answers: i32,
    pub time_taken_seconds: i32,
    pub quiz_title: String,
    pub unit_id: String,
    pub unit_title: String,
}

#[derive(Debug, sqlx::FromRow)]
pub struct QuizAttemptHistoryStats {
    pub total_attempts: i64,
    pub average_score: Option<f64>,
    pub best_score: Option<f64>,
    pub total_time_spent_seconds: Option<i64>,
}

pub async fn get_quiz_attempt_history(
    user_id: &str,
    limit: Option<i32>,
    offset: Option<i32>,
    completed_only: bool,
    pool: &Pool<Postgres>,
) -> Result<(Vec<QuizAttemptHistoryItem>, QuizAttemptHistoryStats, f64), Error> {
    let completed_filter = if completed_only {
        " AND qa.completed_at IS NOT NULL"
    } else {
        ""
    };
    let mut query_string = format!(
        "SELECT qa.id AS attempt_id,
                qa.quiz_id,
                COALESCE(qa.percentage, qa.score)::double precision AS score,
                qa.completed_at AS date,
                qa.total_questions,
                qa.correct_answers,
                COALESCE(qa.time_taken, 0) AS time_taken_seconds,
                q.title AS quiz_title,
                COALESCE(u.id, '') AS unit_id,
                COALESCE(u.title, u.name, '') AS unit_title
         FROM quiz_attempts qa
         JOIN quizzes q ON q.id = qa.quiz_id
         LEFT JOIN units u ON u.id = q.unit_id
         WHERE qa.user_id = $1{completed_filter}
         ORDER BY qa.completed_at DESC, qa.id DESC"
    );
    let mut param_index = 2;

    if limit.is_some() {
        query_string.push_str(&format!(" LIMIT ${}", param_index));
        param_index += 1;
    }
    if offset.is_some() {
        query_string.push_str(&format!(" OFFSET ${}", param_index));
    }

    let mut query = sqlx::query_as::<_, QuizAttemptHistoryItem>(&query_string).bind(user_id);

    if let Some(l) = limit {
        query = query.bind(l);
    }
    if let Some(o) = offset {
        query = query.bind(o);
    }

    let attempts = query.fetch_all(pool).await?;
    let stats_query = format!(
        "SELECT COUNT(*)::bigint AS total_attempts,
                AVG(COALESCE(percentage, score))::double precision AS average_score,
                MAX(COALESCE(percentage, score))::double precision AS best_score,
                COALESCE(SUM(time_taken), 0)::bigint AS total_time_spent_seconds
         FROM quiz_attempts
         WHERE user_id = $1{}",
        if completed_only {
            " AND completed_at IS NOT NULL"
        } else {
            ""
        }
    );
    let stats = sqlx::query_as::<_, QuizAttemptHistoryStats>(&stats_query)
        .bind(user_id)
        .fetch_one(pool)
        .await?;
    let recent_scores_query = format!(
        "SELECT COALESCE(percentage, score)::double precision
         FROM quiz_attempts
         WHERE user_id = $1{}
         ORDER BY completed_at DESC, id DESC
         LIMIT 2",
        if completed_only {
            " AND completed_at IS NOT NULL"
        } else {
            ""
        }
    );
    let recent_scores: Vec<f64> = sqlx::query_scalar(&recent_scores_query)
        .bind(user_id)
        .fetch_all(pool)
        .await?;
    let recent_improvement = match recent_scores.as_slice() {
        [latest, previous] => latest - previous,
        _ => 0.0,
    };

    Ok((attempts, stats, recent_improvement))
}
