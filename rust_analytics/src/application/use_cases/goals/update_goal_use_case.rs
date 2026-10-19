/// Update Goal Use Case
/// Updates a learning goal's status, priority, or other properties

use crate::application::dtos::goals::{UpdateGoalRequest, GoalResponse};
use crate::domain::repositories::GoalRepository;
use crate::shared::error::AnalyticsError;
use std::sync::Arc;
use chrono::Utc;

#[derive(Clone)]
pub struct UpdateGoalUseCase {
    goal_repository: Arc<dyn GoalRepository>,
}

impl UpdateGoalUseCase {
    pub fn new(goal_repository: Arc<dyn GoalRepository>) -> Self {
        Self { goal_repository }
    }

    pub async fn execute(&self, request: UpdateGoalRequest) -> Result<GoalResponse, AnalyticsError> {
        // Validate input
        if request.user_id.is_empty() {
            return Err(AnalyticsError::ValidationError(
                "user_id is required".to_string(),
            ));
        }

        if request.goal_id.is_empty() {
            return Err(AnalyticsError::ValidationError(
                "goal_id is required".to_string(),
            ));
        }

        // Fetch existing goal to preserve data
        let goals = self
            .goal_repository
            .get_user_goals(&request.user_id)
            .await?;

        let mut goal = goals
            .into_iter()
            .find(|g| g.id == request.goal_id)
            .ok_or_else(|| {
                AnalyticsError::ValidationError("Goal not found".to_string())
            })?;

        // Update fields
        if let Some(status) = request.status {
            goal.status = status;

            // Mark completion time if marking as completed
            if goal.status == crate::domain::value_objects::ProgressStatus::Completed {
                goal.completed_at = Some(Utc::now().naive_utc());
            }
        }

        if let Some(priority) = request.priority {
            goal.priority = priority;
        }

        if let Some(target_date) = request.target_date {
            goal.target_date = Some(target_date);
        }

        if let Some(streak_count) = request.streak_count {
            goal.streak_count = streak_count;
        }

        // Persist changes
        self.goal_repository.update_goal(goal.clone()).await?;

        Ok(GoalResponse {
            id: goal.id,
            user_id: goal.user_id,
            title: goal.title,
            status: goal.status,
            category: goal.category,
            priority: goal.priority,
            target_date: goal.target_date,
            completed_at: goal.completed_at,
            streak_count: goal.streak_count,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::UpdateGoalUseCase;
    use crate::{
        application::dtos::goals::UpdateGoalRequest,
        domain::{
            models::{Goal, UpcomingDeadline},
            repositories::GoalRepository,
            value_objects::ProgressStatus,
        },
        shared::error::AnalyticsError,
    };
    use async_trait::async_trait;
    use chrono::{Local, NaiveDate};
    use std::sync::{Arc, Mutex};

    struct MockGoalRepository {
        goals: Vec<Goal>,
        updated_goal: Mutex<Option<Goal>>,
    }

    #[async_trait]
    impl GoalRepository for MockGoalRepository {
        async fn get_user_goals(&self, _user_id: &str) -> Result<Vec<Goal>, AnalyticsError> {
            Ok(self.goals.clone())
        }

        async fn get_goals_by_status(
            &self,
            user_id: &str,
            status: &str,
        ) -> Result<Vec<Goal>, AnalyticsError> {
            Ok(self
                .goals
                .iter()
                .filter(|goal| goal.user_id == user_id && goal.status.to_string() == status)
                .cloned()
                .collect())
        }

        async fn get_upcoming_deadlines(
            &self,
            _user_id: &str,
        ) -> Result<Vec<UpcomingDeadline>, AnalyticsError> {
            Ok(Vec::new())
        }

        async fn update_goal(&self, goal: Goal) -> Result<(), AnalyticsError> {
            *self.updated_goal.lock().expect("mock mutex should not be poisoned") = Some(goal);
            Ok(())
        }
    }

    fn goal() -> Goal {
        Goal {
            id: "goal-1".to_string(),
            user_id: "user-1".to_string(),
            title: "Study anatomy".to_string(),
            status: ProgressStatus::InProgress,
            category: "study".to_string(),
            priority: "normal".to_string(),
            target_date: None,
            completed_at: None,
            created_at: Local::now().naive_local(),
            start_date: None,
            streak_count: 0,
        }
    }

    #[tokio::test]
    async fn test_update_goal_status() {
        let repository = Arc::new(MockGoalRepository {
            goals: vec![goal()],
            updated_goal: Mutex::new(None),
        });
        let use_case = UpdateGoalUseCase::new(repository.clone());

        let response = use_case
            .execute(UpdateGoalRequest {
                user_id: "user-1".to_string(),
                goal_id: "goal-1".to_string(),
                status: Some(ProgressStatus::Completed),
                priority: None,
                target_date: None,
                streak_count: None,
            })
            .await
            .expect("existing goal should be updated");

        assert_eq!(response.status, ProgressStatus::Completed);
        assert!(response.completed_at.is_some());
        let updated = repository
            .updated_goal
            .lock()
            .expect("mock mutex should not be poisoned")
            .clone()
            .expect("repository should receive the update");
        assert_eq!(updated.status, ProgressStatus::Completed);
        assert!(updated.completed_at.is_some());
    }

    #[tokio::test]
    async fn test_update_goal_priority() {
        let repository = Arc::new(MockGoalRepository {
            goals: vec![goal()],
            updated_goal: Mutex::new(None),
        });
        let use_case = UpdateGoalUseCase::new(repository.clone());

        let response = use_case
            .execute(UpdateGoalRequest {
                user_id: "user-1".to_string(),
                goal_id: "goal-1".to_string(),
                status: None,
                priority: Some("high".to_string()),
                target_date: Some(NaiveDate::from_ymd_opt(2026, 12, 31).unwrap()),
                streak_count: Some(4),
            })
            .await
            .expect("existing goal should be updated");

        assert_eq!(response.priority, "high");
        assert_eq!(response.target_date, NaiveDate::from_ymd_opt(2026, 12, 31));
        assert_eq!(response.streak_count, 4);
        let updated = repository
            .updated_goal
            .lock()
            .expect("mock mutex should not be poisoned")
            .clone()
            .expect("repository should receive the update");
        assert_eq!(updated.priority, "high");
        assert_eq!(updated.streak_count, 4);
    }

    #[tokio::test]
    async fn test_update_nonexistent_goal() {
        let use_case = UpdateGoalUseCase::new(Arc::new(MockGoalRepository {
            goals: Vec::new(),
            updated_goal: Mutex::new(None),
        }));

        let result = use_case
            .execute(UpdateGoalRequest {
                user_id: "user-1".to_string(),
                goal_id: "missing".to_string(),
                status: None,
                priority: None,
                target_date: None,
                streak_count: None,
            })
            .await;

        assert!(matches!(result, Err(AnalyticsError::ValidationError(_))));
    }
}
