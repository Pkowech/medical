use std::sync::Arc;
use crate::domain::repositories::ActivityRepository;
use crate::shared::error::AnalyticsError;
use crate::application::dtos::path_analytics::{GetPathAnalyticsRequest, GetPathAnalyticsResponse};

pub struct GetPathAnalyticsUseCase {
    activity_repo: Arc<dyn ActivityRepository + Send + Sync>,
}

impl GetPathAnalyticsUseCase {
    pub fn new(activity_repo: Arc<dyn ActivityRepository + Send + Sync>) -> Self {
        Self { activity_repo }
    }

    pub async fn execute(&self, req: GetPathAnalyticsRequest) -> Result<GetPathAnalyticsResponse, AnalyticsError> {
        let (total, completed) = self.activity_repo.get_learning_path_completion_stats(&req.user_id).await?;

        let completion_rate = if total > 0 {
            (completed as f32 / total as f32) * 100.0
        } else {
            0.0
        };

        Ok(GetPathAnalyticsResponse {
            total_paths: total,
            completed_paths: completed,
            completion_rate,
        })
    }
}
