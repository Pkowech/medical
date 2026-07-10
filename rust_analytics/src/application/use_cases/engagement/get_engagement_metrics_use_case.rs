use std::sync::Arc;
use crate::domain::repositories::ActivityRepository;
use crate::shared::error::AnalyticsError;
use crate::application::dtos::engagement::{GetEngagementMetricsRequest, GetEngagementMetricsResponse};
use crate::analytics::learning::learning_analytics::calculate_engagement_metrics;

pub struct GetEngagementMetricsUseCase {
    activity_repo: Arc<dyn ActivityRepository + Send + Sync>,
}

impl GetEngagementMetricsUseCase {
    pub fn new(activity_repo: Arc<dyn ActivityRepository + Send + Sync>) -> Self {
        Self { activity_repo }
    }

    pub async fn execute(
        &self,
        req: GetEngagementMetricsRequest,
    ) -> Result<GetEngagementMetricsResponse, AnalyticsError> {
        if req.user_id.is_empty() {
            return Err(AnalyticsError::ValidationError("user_id is required".to_string()));
        }

        let activities = self.activity_repo.get_user_activities(&req.user_id).await?;

        let engagement = calculate_engagement_metrics(&activities, &req.user_id);

        let (total_courses, completed_courses) =
            self.activity_repo.get_course_completion_stats(&req.user_id).await?;

        let completion_rate = if total_courses > 0 {
            (completed_courses as f32 / total_courses as f32) * 100.0
        } else {
            0.0
        };

        Ok(GetEngagementMetricsResponse {
            time_spent: engagement.average_session_duration as f32,
            completion_rate,
            activity_frequency: engagement.session_count as i32,
            daily_streak: engagement.daily_active_streak,
            weekly_streak: engagement.weekly_active_streak,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // use async_trait::async_trait;
    // use mockall::{automock, predicate::*};
    // use chrono::{Duration, Utc};

    // #[automock]
    // #[async_trait]
    // impl ActivityRepository for MockActivityRepository {
    //     async fn get_user_activities(&self, user_id: &str) -> Result<Vec<chrono::NaiveDateTime>, AnalyticsError> {
    //         self.get_user_activities(user_id).await
    //     }
    //     async fn get_course_completion_stats(&self, user_id: &str) -> Result<(i32, i32), AnalyticsError> {
    //         self.get_course_completion_stats(user_id).await
    //     }
    //     async fn get_learning_path_completion_stats(&self, user_id: &str) -> Result<(i32, i32), AnalyticsError> {
    //         self.get_learning_path_completion_stats(user_id).await
    //     }
    //     async fn get_last_activity_date(&self, user_id: &str) -> Result<Option<chrono::NaiveDateTime>, AnalyticsError> {
    //         self.get_last_activity_date(user_id).await
    //     }
    //     async fn get_most_active_hour(&self, user_id: &str) -> Result<Option<i32>, AnalyticsError> {
    //         self.get_most_active_hour(user_id).await
    //     }
    // }

    // #[tokio::test]
    // async fn test_get_engagement_metrics_success() {
    //     let mut mock_repo = MockActivityRepository::new();
    //     let now = Utc::now().naive_utc();
    //     let activities = vec![
    //         now - Duration::days(1),
    //         now - Duration::days(2),
    //         now - Duration::hours(5),
    //     ];
    //     mock_repo
    //         .expect_get_user_activities()
    //         .returning(move |_| Ok(activities.clone()));
    //     mock_repo
    //         .expect_get_course_completion_stats()
    //         .returning(|_| Ok((10, 5))); // 50% completion

    //     let use_case = GetEngagementMetricsUseCase::new(Arc::new(mock_repo));

    //     let request = GetEngagementMetricsRequest {
    //         user_id: "user123".to_string(),
    //     };

    //     let response = use_case.execute(request).await.unwrap();

    //     assert_eq!(response.user_id, "user123");
    //     assert!(response.time_spent_minutes > 0.0);
    //     assert_eq!(response.completion_rate_percentage, 50.0);
    //     assert!(response.activity_frequency_score > 0);
    //     assert!(response.daily_streak_count >= 0);
    // }

    // #[tokio::test]
    // async fn test_get_engagement_metrics_empty_user_id() {
    //     let mock_repo = MockActivityRepository::new();
    //     let use_case = GetEngagementMetricsUseCase::new(Arc::new(mock_repo));

    //     let request = GetEngagementMetricsRequest {
    //         user_id: "".to_string(),
    //     };

    //     let error = use_case.execute(request).await.unwrap_err();
    //     assert!(matches!(error, AnalyticsError::ValidationError(_)));
    //     assert_eq!(error.to_string(), "Validation Error: user_id is required");
    // }
}
