/// Update BKT use case
/// Clean Architecture implementation for updating user knowledge state via BKT
use crate::domain::repositories::SkillStateRepository;
use crate::modules::analytics::performance::bkt::{update_p_known, BKTParams};
use crate::observability::metrics as obs_metrics;
use crate::shared::error::AnalyticsError;
use serde::{Deserialize, Serialize};

/// Request to update BKT knowledge state
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateBktRequest {
    pub user_id: String,
    pub skill_id: String,
    pub is_correct: bool,
    pub event_id: Option<String>,
}

/// Response with updated knowledge probability
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UpdateBktResponse {
    pub user_id: String,
    pub skill_id: String,
    pub p_known: f64,
    pub improved: bool,
}

/// Use case for updating BKT skill knowledge state
/// Applies Bayesian Knowledge Tracing algorithm to update student knowledge
pub struct UpdateBktUseCase<R: SkillStateRepository> {
    skill_state_repo: R,
}

impl<R: SkillStateRepository> UpdateBktUseCase<R> {
    pub fn new(skill_state_repo: R) -> Self {
        Self { skill_state_repo }
    }

    /// Execute BKT update
    ///
    /// Algorithm:
    /// 1. Validate inputs
    /// 2. Fetch current p_known or use default (p_init)
    /// 3. Apply BKT update formula based on correctness
    /// 4. Persist new state to repository
    /// 5. Record metrics on improvement
    pub async fn execute(
        &self,
        request: UpdateBktRequest,
    ) -> Result<UpdateBktResponse, AnalyticsError> {
        // Validate inputs
        if request.user_id.is_empty() {
            return Err(AnalyticsError::InvalidUserId);
        }
        if request.skill_id.is_empty() {
            return Err(AnalyticsError::ValidationError(
                "skill_id cannot be empty".to_string(),
            ));
        }

        let (p_known_new, was_applied, improved) = if let Some(event_id) = request.event_id {
            self.skill_state_repo
                .update_user_skill_state_once(
                    &event_id,
                    &request.user_id,
                    &request.skill_id,
                    request.is_correct,
                )
                .await?
        } else {
            let p_known_prev = self
                .skill_state_repo
                .get_user_skill_state(&request.user_id, &request.skill_id)
                .await?
                .unwrap_or(BKTParams::default().p_init);
            let p_known_new =
                update_p_known(p_known_prev, request.is_correct, &BKTParams::default());
            self.skill_state_repo
                .update_user_skill_state(&request.user_id, &request.skill_id, p_known_new)
                .await?;
            self.skill_state_repo
                .increment_attempts(&request.user_id, &request.skill_id)
                .await?;
            (p_known_new, true, p_known_new > p_known_prev)
        };

        // Record metrics
        if was_applied {
            obs_metrics::inc_bkt_update(improved);
        }

        Ok(UpdateBktResponse {
            user_id: request.user_id,
            skill_id: request.skill_id,
            p_known: p_known_new,
            improved,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    struct MockSkillStateRepository {
        p_known: Option<f64>,
    }

    #[async_trait::async_trait]
    impl SkillStateRepository for MockSkillStateRepository {
        async fn get_user_skill_state(
            &self,
            _user_id: &str,
            _skill_id: &str,
        ) -> Result<Option<f64>, AnalyticsError> {
            Ok(self.p_known)
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

        async fn update_user_skill_state_once(
            &self,
            event_id: &str,
            _user_id: &str,
            _skill_id: &str,
            is_correct: bool,
        ) -> Result<(f64, bool, bool), AnalyticsError> {
            let previous = self.p_known.unwrap_or(BKTParams::default().p_init);
            if event_id == "already-processed" {
                return Ok((previous, false, false));
            }
            let next = update_p_known(previous, is_correct, &BKTParams::default());
            Ok((next, true, next > previous))
        }
    }

    #[tokio::test]
    async fn test_update_bkt_correct_answer() {
        let repo = MockSkillStateRepository { p_known: Some(0.5) };
        let use_case = UpdateBktUseCase::new(repo);

        let request = UpdateBktRequest {
            user_id: "user123".to_string(),
            skill_id: "math".to_string(),
            is_correct: true,
            event_id: None,
        };

        let result = use_case.execute(request).await;
        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(response.p_known > 0.5); // Knowledge should increase
        assert!(response.improved);
    }

    #[tokio::test]
    async fn test_update_bkt_incorrect_answer() {
        let repo = MockSkillStateRepository { p_known: Some(0.8) };
        let use_case = UpdateBktUseCase::new(repo);

        let request = UpdateBktRequest {
            user_id: "user123".to_string(),
            skill_id: "math".to_string(),
            is_correct: false,
            event_id: None,
        };

        let result = use_case.execute(request).await;
        assert!(result.is_ok());

        let response = result.unwrap();
        assert!(response.p_known < 0.8); // Knowledge should decrease
        assert!(!response.improved);
    }

    #[tokio::test]
    async fn test_update_bkt_new_skill() {
        let repo = MockSkillStateRepository { p_known: None };
        let use_case = UpdateBktUseCase::new(repo);

        let request = UpdateBktRequest {
            user_id: "new_user".to_string(),
            skill_id: "new_skill".to_string(),
            is_correct: true,
            event_id: None,
        };

        let result = use_case.execute(request).await;
        assert!(result.is_ok());

        let response = result.unwrap();
        // Should start from p_init (0.4) and move up after correct answer
        assert!(response.p_known > BKTParams::default().p_init);
    }

    #[tokio::test]
    async fn test_update_bkt_does_not_apply_duplicate_event() {
        let repo = MockSkillStateRepository { p_known: Some(0.5) };
        let use_case = UpdateBktUseCase::new(repo);

        let response = use_case
            .execute(UpdateBktRequest {
                user_id: "user123".to_string(),
                skill_id: "math".to_string(),
                is_correct: true,
                event_id: Some("already-processed".to_string()),
            })
            .await
            .unwrap();

        assert_eq!(response.p_known, 0.5);
        assert!(!response.improved);
    }

    #[tokio::test]
    async fn test_update_bkt_invalid_user_id() {
        let repo = MockSkillStateRepository { p_known: Some(0.5) };
        let use_case = UpdateBktUseCase::new(repo);

        let request = UpdateBktRequest {
            user_id: "".to_string(),
            skill_id: "math".to_string(),
            is_correct: true,
            event_id: None,
        };

        let result = use_case.execute(request).await;
        assert!(matches!(result, Err(AnalyticsError::InvalidUserId)));
    }

    #[tokio::test]
    async fn test_update_bkt_invalid_skill_id() {
        let repo = MockSkillStateRepository { p_known: Some(0.5) };
        let use_case = UpdateBktUseCase::new(repo);

        let request = UpdateBktRequest {
            user_id: "user123".to_string(),
            skill_id: "".to_string(),
            is_correct: true,
            event_id: None,
        };

        let result = use_case.execute(request).await;
        assert!(matches!(result, Err(AnalyticsError::ValidationError(_))));
    }
}
