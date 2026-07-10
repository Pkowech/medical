use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct QuizAttempt {
    pub quiz_id: String,
    pub score: f64,
    pub date: String,
}
