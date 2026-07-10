use std::sync::Arc;
use crate::domain::repositories::ActivityRepository;
use crate::shared::error::AnalyticsError;
use crate::application::dtos::course_progress::{GetCourseProgressRequest, GetCourseProgressResponse};

pub struct GetCourseProgressUseCase {
    activity_repo: Arc<dyn ActivityRepository + Send + Sync>,
}

impl GetCourseProgressUseCase {
    pub fn new(activity_repo: Arc<dyn ActivityRepository + Send + Sync>) -> Self {
        Self { activity_repo }
    }

    pub async fn execute(&self, req: GetCourseProgressRequest) -> Result<GetCourseProgressResponse, AnalyticsError> {
        let (total, completed) = self.activity_repo.get_course_completion_stats(&req.user_id).await?;

        let completion_rate = if total > 0 {
            (completed as f32 / total as f32) * 100.0
        } else {
            0.0
        };

        Ok(GetCourseProgressResponse {
            total_courses: total,
            completed_courses: completed,
            completion_rate,
        })
    }
}
