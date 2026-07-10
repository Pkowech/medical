/// Performance prediction use case
/// Clean Architecture implementation for predicting user performance on quizzes

use crate::domain::repositories::{SkillStateRepository, QuizRepository};
use crate::shared::error::AnalyticsError;
use serde::{Deserialize, Serialize};

/// Request for performance prediction
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictPerformanceRequest {
    pub user_id: String,
    pub skill_id: String,
}

/// Response with predicted performance score
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PredictPerformanceResponse {
    pub score: f32,
    pub explanation: Option<String>,
}

/// Use case for predicting user performance
/// Separates business logic from gRPC handler concerns
pub struct PredictPerformanceUseCase<R: SkillStateRepository, Q: QuizRepository> {
    skill_state_repo: R,
    quiz_repo: Q,
}

impl<R: SkillStateRepository, Q: QuizRepository> PredictPerformanceUseCase<R, Q> {
    pub fn new(skill_state_repo: R, quiz_repo: Q) -> Self {
        Self { skill_state_repo, quiz_repo }
    }

    /// Execute the prediction logic
    /// 
    /// Algorithm:
    /// 1. Get current p_known (probability of knowing skill)
    /// 2. Get recent quiz performance (last 10 attempts)
    /// 3. Calculate trend score from recent performance
    /// 4. Blend historical (40%) and trend (60%) for final prediction
    /// 5. Optionally apply ML model if LINFA_ENABLED
    pub async fn execute(
        &self,
        request: PredictPerformanceRequest,
    ) -> Result<PredictPerformanceResponse, AnalyticsError> {
        // Validation
        if request.user_id.is_empty() {
            return Err(AnalyticsError::InvalidUserId);
        }
        if request.skill_id.is_empty() {
            return Err(AnalyticsError::ValidationError("skill_id cannot be empty".to_string()));
        }

        // Fetch current BKT state
        let p_known = self.skill_state_repo
            .get_user_skill_state(&request.user_id, &request.skill_id)
            .await?
            .unwrap_or(0.5);

        // Get recent quiz performance
        let history = self.quiz_repo
            .get_quiz_attempt_history(&request.user_id, Some(10), Some(0))
            .await?;
        
        let recent_total = history.len() as i64;
        let recent_correct = history.iter().filter(|a| a.score >= 80.0).count() as i64;

        // Calculate trend score from recent performance
        let trend_score = if recent_total > 0 {
            recent_correct as f32 / recent_total as f32
        } else {
            0.5
        };

        // Blend historical and recent trend: 40% historical, 60% trend
        let historical = p_known as f32;
        let mut predicted_score = (historical * 0.4 + trend_score * 0.6)
            .min(1.0)
            .max(0.0);

        // Check if ML model is enabled
        let linfa_enabled = std::env::var("LINFA_ENABLED")
            .unwrap_or_else(|_| "true".to_string())
            .to_lowercase();
        
        if linfa_enabled == "true" || linfa_enabled == "1" {
            // Try to enhance prediction with ML model
            match self.predict_with_ml(historical, trend_score).await {
                Ok(ml_score) => {
                    let linfa_weight = std::env::var("LINFA_WEIGHT")
                        .unwrap_or_else(|_| "0.4".to_string())
                        .parse::<f32>()
                        .unwrap_or(0.4)
                        .min(1.0)
                        .max(0.0);

                    predicted_score = ((1.0 - linfa_weight) * predicted_score 
                        + linfa_weight * ml_score as f32) as f32;
                }
                Err(e) => {
                    eprintln!("ML prediction failed: {}", e);
                    // Fall back to heuristic
                }
            }
        }

        let explanation = Some(format!(
            "Predicted based on {} historical performance and {} recent trend",
            (historical * 100.0) as i32,
            (trend_score * 100.0) as i32
        ));

        Ok(PredictPerformanceResponse {
            score: predicted_score,
            explanation,
        })
    }

    /// Apply ML model for enhanced prediction
    async fn predict_with_ml(&self, historical: f32, trend_score: f32) -> Result<f64, AnalyticsError> {
        use ndarray::array;

        // Build feature vector
        let features = array![[historical as f64 * 100.0, trend_score as f64 * 100.0, 10.0]];
        let targets = ndarray::Array1::from_vec(vec![trend_score as f64 * 100.0]);

        match crate::modules::analytics::performance::prediction::predict_performance(&features, &targets) {
            Ok(predictions) => {
                let raw_prediction = predictions.get(0).cloned().unwrap_or(0.0);
                let normalized = (raw_prediction / 100.0).min(1.0).max(0.0);
                Ok(normalized)
            }
            Err(e) => Err(AnalyticsError::Prediction(format!("ML prediction failed: {}", e))),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    // Mock repository for testing
    struct MockSkillStateRepository {
        p_known: f64,
    }

    #[async_trait::async_trait]
    impl SkillStateRepository for MockSkillStateRepository {
        async fn get_user_skill_state(
            &self,
            _user_id: &str,
            _skill_id: &str,
        ) -> Result<Option<f64>, AnalyticsError> {
            Ok(Some(self.p_known))
        }

        async fn update_user_skill_state(
            &self,
            _user_id: &str,
            _skill_id: &str,
            _p_known: f64,
        ) -> Result<(), AnalyticsError> {
            Ok(())
        }

        async fn get_all_skill_states(
            &self,
            _user_id: &str,
        ) -> Result<Vec<(String, f64)>, AnalyticsError> {
            Ok(vec![])
        }

        async fn get_weakest_skills(
            &self,
            _user_id: &str,
            _limit: usize,
        ) -> Result<Vec<(String, f64)>, AnalyticsError> {
            Ok(vec![])
        }

        async fn increment_attempts(
            &self,
            _user_id: &str,
            _skill_id: &str,
        ) -> Result<(), AnalyticsError> {
            Ok(())
        }
    }

    #[tokio::test]
    async fn test_predict_performance_valid_input() {
        let repo = MockSkillStateRepository { p_known: 0.7 };
        let use_case = PredictPerformanceUseCase::new(repo, MockQuizRepo);

        let request = PredictPerformanceRequest {
            user_id: "user123".to_string(),
            skill_id: "math_algebra".to_string(),
        };

        let result = use_case.execute(request).await;
        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(response.score >= 0.0 && response.score <= 1.0);
    }

    #[tokio::test]
    async fn test_predict_performance_invalid_user_id() {
        let repo = MockSkillStateRepository { p_known: 0.7 };
        let use_case = PredictPerformanceUseCase::new(repo, MockQuizRepo);

        let request = PredictPerformanceRequest {
            user_id: "".to_string(),
            skill_id: "math_algebra".to_string(),
        };

        let result = use_case.execute(request).await;
        assert!(matches!(result, Err(AnalyticsError::InvalidUserId)));
    }

    #[tokio::test]
    async fn test_predict_performance_invalid_skill_id() {
        let repo = MockSkillStateRepository { p_known: 0.7 };
        let use_case = PredictPerformanceUseCase::new(repo, MockQuizRepo);

        let request = PredictPerformanceRequest {
            user_id: "user123".to_string(),
            skill_id: "".to_string(),
        };

        let result = use_case.execute(request).await;
        assert!(matches!(result, Err(AnalyticsError::ValidationError(_))));
    }

    #[tokio::test]
    async fn test_predict_performance_default_knowledge() {
        let repo = MockSkillStateRepository { p_known: 0.0 };
        let use_case = PredictPerformanceUseCase::new(repo, MockQuizRepo);

        let request = PredictPerformanceRequest {
            user_id: "new_user".to_string(),
            skill_id: "math_algebra".to_string(),
        };

        let result = use_case.execute(request).await;
        assert!(result.is_ok());

        let response = result.unwrap();
        // With no knowledge, prediction should be within valid probability range
        assert!(response.score >= 0.0 && response.score <= 1.0);
    }

    struct MockQuizRepo;

    #[async_trait::async_trait]
    impl crate::domain::repositories::QuizRepository for MockQuizRepo {
        async fn get_quiz_attempt_history(
            &self,
            _user_id: &str,
            _limit: Option<i32>,
            _offset: Option<i32>,
        ) -> Result<Vec<crate::domain::models::quiz::QuizAttempt>, AnalyticsError> {
            Ok(vec![])
        }

        async fn record_quiz_attempt(
            &self,
            _user_id: &str,
            _quiz_id: &str,
            _score: f64,
            _is_correct: bool,
        ) -> Result<String, AnalyticsError> {
            Ok("attempt-id".to_string())
        }

        async fn get_recent_quiz_performance(
            &self,
            _user_id: &str,
            _skill_id: &str,
            _limit: i64,
        ) -> Result<(i64, i64), AnalyticsError> {
            Ok((0, 0))
        }

        async fn get_average_quiz_score(&self, _user_id: &str) -> Result<f32, AnalyticsError> {
            Ok(0.0)
        }

        async fn count_quiz_attempts(&self, _user_id: &str) -> Result<i64, AnalyticsError> {
            Ok(0)
        }
    }
}
