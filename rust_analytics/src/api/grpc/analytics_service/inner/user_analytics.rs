use super::*;
impl super::MyAnalyticsService {
    pub async fn calculate_course_progress_internal(
        &self,
        user_id: String,
        course_id: String,
    ) -> Result<crate::analytics_proto::CourseProgress, tonic::Status> {
        if course_id.is_empty() {
            return Err(tonic::Status::invalid_argument("course_id cannot be empty"));
        }

        crate::modules::analytics::progress_tracking::calculate_course_progress(
            &self.pool,
            &user_id,
            &course_id,
        )
        .await
        .map_err(|error| {
            tonic::Status::internal(format!("DB error calculating course progress: {error}"))
        })
    }
}
