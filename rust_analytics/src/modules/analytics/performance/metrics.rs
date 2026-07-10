use serde::{Deserialize, Serialize};
use sqlx::{Error, Pool, Postgres};

#[derive(Debug, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub user_id: String,
    pub total_study_time: i64,
    pub average_score: f64,
}

#[derive(Debug, sqlx::FromRow)]
pub struct LearningHistoryItem {
    pub score: Option<f64>,
    pub duration: Option<i32>,
}

pub async fn calculate_performance_metrics(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<PerformanceMetrics, Error> {
    let learning_history = sqlx::query_as::<_, LearningHistoryItem>(
        "SELECT score, duration FROM learning_history WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let total_study_time: i64 = learning_history
        .iter()
        .filter_map(|item| item.duration)
        .map(|d| d as i64)
        .sum();

    let scores: Vec<f64> = learning_history
        .iter()
        .filter_map(|item| item.score)
        .collect();
    let average_score: f64 = if scores.is_empty() {
        0.0
    } else {
        scores.iter().sum::<f64>() / scores.len() as f64
    };

    Ok(PerformanceMetrics {
        user_id: user_id.to_string(),
        total_study_time,
        average_score,
    })
}
use burn::{
    module::Module,
    tensor::{backend::Backend, Tensor},
};

#[allow(dead_code)]
#[derive(Module, Debug, Clone)]
pub struct MyModule {}

#[allow(dead_code)]
impl MyModule {
    pub fn new() -> Self {
        Self {}
    }

    pub fn forward<B: Backend>(&self, input: Tensor<B, 2>) -> Tensor<B, 2> {
        input.mul_scalar(2.0)
    }
}

#[allow(dead_code)]
pub fn calculate_metrics<B: Backend>(input_data: Tensor<B, 2>) -> Tensor<B, 2> {
    println!("Calculating metrics with Burn...");

    let module = MyModule::new();
    let output = module.forward(input_data);

    output
}
