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
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_update_goal_status() {
        // Test status update with completion timestamp
    }

    #[tokio::test]
    #[ignore]
    async fn test_update_goal_priority() {
        // Test priority update
    }

    #[tokio::test]
    #[ignore]
    async fn test_update_nonexistent_goal() {
        // Test error handling for missing goal
    }
}
