use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Serialize, Deserialize)]
pub struct Prediction {
    pub metric: String,
    pub value: f64,
    pub confidence: f64,
}

#[derive(Serialize, Deserialize)]
pub struct Predictions {
    pub user_id: String,
    pub predictions: Vec<Prediction>,
}

pub async fn generate_predictions(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<Predictions, String> {
    let quiz_attempts =
        sqlx::query_scalar::<_, i64>("SELECT COUNT(*) FROM quiz_attempts WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await
            .unwrap_or(0);

    let avg_score = sqlx::query_scalar::<_, Option<f64>>(
        "SELECT AVG(score) FROM quiz_attempts WHERE user_id = $1 AND score IS NOT NULL",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(Some(0.0))
    .unwrap_or(0.0);

    let completed_courses = sqlx::query_scalar::<_, i64>(
        "SELECT COUNT(*) FROM enrollments WHERE user_id = $1 AND status = 'completed'",
    )
    .bind(user_id)
    .fetch_one(pool)
    .await
    .unwrap_or(0);

    let confidence_base = if quiz_attempts > 10 {
        0.85
    } else if quiz_attempts > 5 {
        0.7
    } else {
        0.5
    };

    let success_rate_prediction = if avg_score > 0.0 {
        (avg_score / 100.0).min(1.0).max(0.0)
    } else {
        0.5
    };

    let completion_rate_prediction = if completed_courses > 0 {
        (completed_courses as f64 / (completed_courses as f64 + 2.0)).min(0.95)
    } else {
        0.4
    };

    Ok(Predictions {
        user_id: user_id.to_string(),
        predictions: vec![
            Prediction {
                metric: "success_rate".to_string(),
                value: success_rate_prediction,
                confidence: confidence_base,
            },
            Prediction {
                metric: "completion_rate".to_string(),
                value: completion_rate_prediction,
                confidence: confidence_base * 0.9,
            },
            Prediction {
                metric: "average_score".to_string(),
                value: avg_score,
                confidence: confidence_base * 0.95,
            },
        ],
    })
}
