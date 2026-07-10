/// Get Learning Goals Use Case
/// Retrieves user's learning goals and upcoming deadlines

use crate::application::dtos::goals::{GoalsRequest, GoalsResponse};
use crate::domain::repositories::GoalRepository;
use crate::shared::error::AnalyticsError;
use std::sync::Arc;

#[derive(Clone)]
pub struct GetGoalsUseCase {
    goal_repository: Arc<dyn GoalRepository>,
}

impl GetGoalsUseCase {
    pub fn new(goal_repository: Arc<dyn GoalRepository>) -> Self {
        Self { goal_repository }
    }

    pub async fn execute(&self, request: GoalsRequest) -> Result<GoalsResponse, AnalyticsError> {
        // Validate input
        if request.user_id.is_empty() {
            return Err(AnalyticsError::ValidationError(
                "user_id is required".to_string(),
            ));
        }

        // Fetch user's goals
        let goals = self
            .goal_repository
            .get_user_goals(&request.user_id)
            .await?;

        // Filter by status if provided
        let filtered_goals = if let Some(status_str) = request.status {
            goals
                .into_iter()
                .filter(|g| g.status.to_string() == status_str)
                .collect()
        } else {
            goals
        };

        // Fetch upcoming deadlines
        let upcoming_deadlines = self
            .goal_repository
            .get_upcoming_deadlines(&request.user_id)
            .await
            .unwrap_or_default();

        // Calculate days remaining for each deadline and convert to DTO type
        use crate::application::dtos::goals::UpcomingDeadline as DtoUpcomingDeadline;
        let upcoming_deadlines: Vec<DtoUpcomingDeadline> = upcoming_deadlines
            .into_iter()
            .map(|deadline| {
                let days = (deadline.target_date - chrono::Local::now().date_naive()).num_days();
                DtoUpcomingDeadline {
                    goal_id: deadline.goal_id,
                    title: deadline.title,
                    target_date: deadline.target_date,
                    days_remaining: days as i32,
                }
            })
            .collect();


        let total_goals = filtered_goals.len() as i32;
        Ok(GoalsResponse {
            user_id: request.user_id.clone(),
            goals: filtered_goals,
            upcoming_deadlines,
            total_goals,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_get_goals_success() {
        // Mock repository tests
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_goals_validation() {
        // Validate empty user_id rejection
    }
}
