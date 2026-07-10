use sqlx::{Pool, Postgres};
use tonic::{Request, Response, Status};
use std::sync::Arc;
use crate::analytics_proto::{
    GetEngagementMetricsRequest, GetEngagementMetricsResponse,
    QuizAttemptHistoryRequest, QuizAttemptHistoryResponse, QuizAttemptHistoryItem,
};

pub struct EngagementService {
    pool: Pool<Postgres>,
}

impl EngagementService {
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self { pool }
    }

    fn validate_user_id(user_id: &str) -> Result<(), Status> {
        if user_id.is_empty() {
            return Err(Status::invalid_argument("user_id cannot be empty"));
        }
        Ok(())
    }

    pub async fn get_engagement_metrics(
        &self,
        request: Request<GetEngagementMetricsRequest>,
    ) -> Result<Response<GetEngagementMetricsResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id;

        Self::validate_user_id(&user_id)?;

        let repo = crate::infrastructure::database::repositories::PostgresActivityRepository::new(Arc::new(self.pool.clone()));
        let use_case = crate::application::use_cases::engagement::GetEngagementMetricsUseCase::new(std::sync::Arc::new(repo));

        let app_req = crate::application::dtos::engagement::GetEngagementMetricsRequest { user_id: user_id.clone() };
        let result = use_case
            .execute(app_req)
            .await
            .map_err(|e| Status::internal(format!("Engagement metrics failed: {}", e)))?;

        Ok(Response::new(GetEngagementMetricsResponse {
            time_spent: result.time_spent,
            completion_rate: result.completion_rate,
            activity_frequency: result.activity_frequency,
            daily_streak: result.daily_streak,
            weekly_streak: result.weekly_streak,
        }))
    }

    pub async fn get_quiz_attempt_history(
        &self, 
        request: Request<QuizAttemptHistoryRequest>
    ) -> Result<Response<QuizAttemptHistoryResponse>, Status> {
        let r = request.into_inner();
        let limit = if r.limit <= 0 { None } else { Some(r.limit) };
        let offset = if r.offset <= 0 { None } else { Some(r.offset) };

        match crate::modules::analytics::engagement::quiz_history::get_quiz_attempt_history(&r.user_id, limit, offset, &self.pool).await {
            Ok(attempts) => {
                let proto_attempts = attempts
                    .into_iter()
                    .map(|a| QuizAttemptHistoryItem { 
                        quiz_id: a.quiz_id, 
                        score: a.score, 
                        date: a.date 
                    })
                    .collect();
                Ok(Response::new(QuizAttemptHistoryResponse { attempts: proto_attempts }))
            }
            Err(e) => Err(Status::internal(format!("quiz history failed: {}", e))),
        }
    }

    pub async fn batch_track_events(
        &self,
        request: Request<crate::analytics_proto::BatchEventRequest>,
    ) -> Result<Response<crate::analytics_proto::BatchEventResponse>, Status> {
        let req = request.into_inner();

        let mapped: Vec<crate::modules::analytics::events::EventPayload> = req
            .events
            .into_iter()
            .map(|e| crate::modules::analytics::events::EventPayload {
                event_type: e.event_type,
                data: Some(crate::shared::utils::proto_value_to_json(e.data)), // Assuming shared utility or I need to copy proto_value_to_json
                timestamp: e.timestamp,
                session_id: Some(e.session_id),
                duration: Some(e.duration),
            })
            .collect();

        match crate::modules::analytics::events::store_batch_events(&req.user_id, mapped, &self.pool).await {
            Ok(res) => Ok(Response::new(crate::analytics_proto::BatchEventResponse {
                success: res.success,
                processed: res.processed as i32,
                failed: res.failed as i32,
                message: res.message,
            })),
            Err(e) => Err(Status::internal(format!("batch store failed: {}", e))),
        }
    }
}
