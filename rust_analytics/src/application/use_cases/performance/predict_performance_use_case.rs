/// Performance prediction use case
/// Clean Architecture implementation for predicting user performance on quizzes
use crate::domain::repositories::{QuizRepository, SkillStateRepository};
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
        Self {
            skill_state_repo,
            quiz_repo,
        }
    }

    /// Execute the prediction logic
    ///
    /// Algorithm:
    /// 1. Get current p_known (probability of knowing skill)
    /// 2. Get recent quiz performance (last 10 attempts)
    /// 3. Calculate trend score from recent performance
    /// 4. Blend the Bayesian knowledge estimate with the recent score average
    pub async fn execute(
        &self,
        request: PredictPerformanceRequest,
    ) -> Result<PredictPerformanceResponse, AnalyticsError> {
        // Validation
        if request.user_id.is_empty() {
            return Err(AnalyticsError::InvalidUserId);
        }
        if request.skill_id.is_empty() {
            return Err(AnalyticsError::ValidationError(
                "skill_id cannot be empty".to_string(),
            ));
        }

        // Fetch current BKT state
        let p_known = self
            .skill_state_repo
            .get_user_skill_state(&request.user_id, &request.skill_id)
            .await?
            .unwrap_or(crate::modules::analytics::performance::bkt::BKTParams::default().p_init);

        // Use completed quiz attempts only; scores in quiz_attempts are percentages.
        let history = self
            .quiz_repo
            .get_quiz_attempt_history(&request.user_id, Some(&request.skill_id), Some(10), Some(0))
            .await?;

        let historical = if p_known.is_finite() {
            p_known.clamp(0.0, 1.0) as f32
        } else {
            crate::modules::analytics::performance::bkt::BKTParams::default().p_init as f32
        };
        let recent_scores: Vec<f32> = history
            .iter()
            .filter(|attempt| attempt.score.is_finite())
            .map(|attempt| (attempt.score / 100.0).clamp(0.0, 1.0) as f32)
            .collect();
        let recent_average = if recent_scores.is_empty() {
            None
        } else {
            Some(recent_scores.iter().sum::<f32>() / recent_scores.len() as f32)
        };
        let predicted_score = recent_average
            .map(|recent| (historical + recent) / 2.0)
            .unwrap_or(historical)
            .clamp(0.0, 1.0);

        let explanation = Some(format!(
            "Estimated from Bayesian skill mastery ({:.0}%) and the average of {} recent completed quiz attempts",
            historical * 100.0,
            recent_scores.len()
        ));

        Ok(PredictPerformanceResponse {
            score: predicted_score,
            explanation,
        })
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

    #[tokio::test]
    async fn prediction_uses_mean_of_real_quiz_scores_and_skill_state() {
        let repo = MockSkillStateRepository { p_known: 0.8 };
        let use_case =
            PredictPerformanceUseCase::new(repo, MockQuizRepoWithScores(vec![80.0, 60.0]));
        let response = use_case
            .execute(PredictPerformanceRequest {
                user_id: "user123".to_string(),
                skill_id: "topic123".to_string(),
            })
            .await
            .unwrap();

        assert!((response.score - 0.75).abs() < f32::EPSILON);
        assert!(response.explanation.unwrap().contains("2 recent completed"));
    }

    struct MockQuizRepo;

    #[async_trait::async_trait]
    impl crate::domain::repositories::QuizRepository for MockQuizRepo {
        async fn get_quiz_attempt_history(
            &self,
            _user_id: &str,
            _skill_id: Option<&str>,
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

    struct MockQuizRepoWithScores(Vec<f64>);

    #[async_trait::async_trait]
    impl crate::domain::repositories::QuizRepository for MockQuizRepoWithScores {
        async fn get_quiz_attempt_history(
            &self,
            _user_id: &str,
            _skill_id: Option<&str>,
            _limit: Option<i32>,
            _offset: Option<i32>,
        ) -> Result<Vec<crate::domain::models::quiz::QuizAttempt>, AnalyticsError> {
            Ok(self
                .0
                .iter()
                .map(|score| crate::domain::models::quiz::QuizAttempt {
                    quiz_id: "quiz123".to_string(),
                    score: *score,
                    date: String::new(),
                })
                .collect())
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
            Ok(self.0.len() as i64)
        }
    }
}
