use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NextStep {
    pub step: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_duration_minutes: Option<i32>,
}

pub async fn generate_next_steps(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<Vec<NextStep>, String> {
    println!("Generating next steps for user: {}", user_id);

    let incomplete_courses = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM enrollments WHERE user_id = $1 AND status != 'completed'",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let recent_quiz_score = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT score FROM quiz_attempts WHERE user_id = $1 ORDER BY completed_at DESC LIMIT 1",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .ok()
    .flatten();

    let mut next_steps = Vec::new();

    if incomplete_courses > 0 {
        next_steps.push(NextStep {
            step: "Complete the current course".to_string(),
            reason: Some("Finish what you started before moving on".to_string()),
            estimated_duration_minutes: Some(45),
        });
    }

    if let Some(score) = recent_quiz_score {
        if score < 70.0 {
            next_steps.push(NextStep {
                step: "Review weak areas".to_string(),
                reason: Some("Recent quiz performance indicates knowledge gaps".to_string()),
                estimated_duration_minutes: Some(30),
            });
        } else {
            next_steps.push(NextStep {
                step: "Move to advanced material".to_string(),
                reason: Some("Strong performance - ready for next level".to_string()),
                estimated_duration_minutes: Some(45),
            });
        }
    }

    next_steps.push(NextStep {
        step: "Practice with clinical cases".to_string(),
        reason: Some("Apply knowledge in realistic scenarios".to_string()),
        estimated_duration_minutes: Some(60),
    });

    if next_steps.is_empty() {
        next_steps.push(NextStep {
            step: "Start a new learning path".to_string(),
            reason: Some("Begin your medical education journey".to_string()),
            estimated_duration_minutes: Some(30),
        });
    }

    Ok(next_steps)
}

#[allow(dead_code)]
pub async fn get_immediate_next_steps(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<Vec<NextStep>, String> {
    println!("Getting immediate next steps for user: {}", user_id);

    let mut steps = generate_next_steps(user_id, pool).await?;
    steps.truncate(2);
    Ok(steps)
}
