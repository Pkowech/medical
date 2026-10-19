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
    use super::GetGoalsUseCase;
    use crate::{
        application::dtos::goals::GoalsRequest,
        domain::{
            models::{Goal, UpcomingDeadline},
            repositories::GoalRepository,
            value_objects::ProgressStatus,
        },
        shared::error::AnalyticsError,
    };
    use async_trait::async_trait;
    use chrono::{Duration, Local};
    use std::sync::Arc;

    struct MockGoalRepository {
        goals: Vec<Goal>,
        deadlines: Vec<UpcomingDeadline>,
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
            Ok(self.deadlines.clone())
        }

        async fn update_goal(&self, _goal: Goal) -> Result<(), AnalyticsError> {
            Ok(())
        }
    }

    fn goal(id: &str, status: ProgressStatus) -> Goal {
        Goal {
            id: id.to_string(),
            user_id: "user-1".to_string(),
            title: format!("Goal {id}"),
            status,
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
    async fn test_get_goals_success() {
        let target_date = Local::now().date_naive() + Duration::days(3);
        let repository = Arc::new(MockGoalRepository {
            goals: vec![
                goal("active", ProgressStatus::Active),
                goal("completed", ProgressStatus::Completed),
            ],
            deadlines: vec![UpcomingDeadline {
                goal_id: "active".to_string(),
                title: "Goal active".to_string(),
                target_date,
                days_remaining: 0,
            }],
        });
        let use_case = GetGoalsUseCase::new(repository);

        let response = use_case
            .execute(GoalsRequest {
                user_id: "user-1".to_string(),
                status: Some("active".to_string()),
            })
            .await
            .expect("valid request should return goals");

        assert_eq!(response.total_goals, 1);
        assert_eq!(response.goals[0].id, "active");
        assert_eq!(response.upcoming_deadlines.len(), 1);
        assert_eq!(response.upcoming_deadlines[0].target_date, target_date);
        assert_eq!(response.upcoming_deadlines[0].days_remaining, 3);
    }

    #[tokio::test]
    async fn test_get_goals_validation() {
        let use_case = GetGoalsUseCase::new(Arc::new(MockGoalRepository {
            goals: Vec::new(),
            deadlines: Vec::new(),
        }));

        let result = use_case
            .execute(GoalsRequest {
                user_id: String::new(),
                status: None,
            })
            .await;

        assert!(matches!(result, Err(AnalyticsError::ValidationError(_))));
    }
}
