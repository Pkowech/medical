use sqlx::{Pool, Postgres};
use tonic::{Request, Response, Status};
use std::sync::Arc;
use crate::analytics_proto::{
    PredictPerformanceRequest, PredictPerformanceResponse,
    UpdateBktRequest, UpdateBktResponse,
};
use crate::infrastructure::database::repositories::PostgresSkillStateRepository;
use crate::application::use_cases::performance::{
    PredictPerformanceUseCase,
    PredictPerformanceRequest as AppPredictPerformanceRequest,
    UpdateBktUseCase,
    UpdateBktRequest as AppUpdateBktRequest,
};

pub struct PerformanceService {
    pool: Pool<Postgres>,
}

impl PerformanceService {
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self { pool }
    }

    fn validate_user_skill(user_id: &str, skill_id: &str) -> Result<(), Status> {
        if user_id.is_empty() {
            return Err(Status::invalid_argument("user_id cannot be empty"));
        }
        if skill_id.is_empty() {
            return Err(Status::invalid_argument("skill_id cannot be empty"));
        }
        Ok(())
    }

    pub async fn predict_performance(
        &self,
        request: Request<PredictPerformanceRequest>,
    ) -> Result<Response<PredictPerformanceResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id;
        let skill_id = req.skill_id;

        Self::validate_user_skill(&user_id, &skill_id)?;

        let repo = PostgresSkillStateRepository::new(Arc::new(self.pool.clone()));
        let quiz_repo = crate::infrastructure::database::repositories::quiz_repository::PostgresQuizRepository::new(Arc::new(self.pool.clone()));
        let use_case = PredictPerformanceUseCase::new(repo, quiz_repo);

        let app_req = AppPredictPerformanceRequest { user_id: user_id.clone(), skill_id: skill_id.clone() };
        let result = use_case
            .execute(app_req)
            .await
            .map_err(|e| Status::internal(format!("Prediction failed: {}", e)))?;

        Ok(Response::new(PredictPerformanceResponse { score: result.score }))
    }

    pub async fn update_bkt(
        &self,
        request: Request<UpdateBktRequest>,
    ) -> Result<Response<UpdateBktResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id;
        let skill_id = req.skill_id;
        let is_correct = req.is_correct;

        Self::validate_user_skill(&user_id, &skill_id)?;

        let repo = PostgresSkillStateRepository::new(Arc::new(self.pool.clone()));
        let use_case = UpdateBktUseCase::new(repo);

        let app_req = AppUpdateBktRequest { user_id: user_id.clone(), skill_id: skill_id.clone(), is_correct };
        let result = use_case
            .execute(app_req)
            .await
            .map_err(|e| Status::internal(format!("BKT update failed: {}", e)))?;

        Ok(Response::new(UpdateBktResponse {
            user_id: result.user_id,
            skill_id: result.skill_id,
            p_known: result.p_known,
        }))
    }

    pub async fn predict_burn_model(
        &self, 
        request: Request<crate::analytics_proto::PredictBurnRequest>
    ) -> Result<Response<crate::analytics_proto::PredictBurnResponse>, Status> {
        let r = request.into_inner();
        
        let model_path = format!("models/burn/{}.mdl", r.user_id);
        let features_f32: Vec<f32> = r.features.iter().map(|v| *v as f32).collect();
        // Note: Generic type NdArray might need import or full path
        let (score, ver) = crate::domain::services::burn_model_service::predict_with_saved_model::<burn::backend::ndarray::NdArray<f32>>(&r.user_id, features_f32, &model_path);
        Ok(Response::new(crate::analytics_proto::PredictBurnResponse { retention_score: score as f64, model_version: ver }))
    }

    pub async fn update_bkt_skill_metrics(
        &self,
        request: Request<()>,
    ) -> Result<Response<crate::analytics_proto::UpdateBktSkillMetricsResponse>, Status> {
        let _req = request.into_inner();

        match crate::modules::analytics::core::batch_processing::update_bkt_skill_avg_metrics(&self.pool).await {
            Ok(_) => Ok(Response::new(crate::analytics_proto::UpdateBktSkillMetricsResponse {
                success: true,
                message: "BKT skill metrics updated successfully".to_string(),
            })),
            Err(e) => Err(Status::internal(format!("Failed to update BKT metrics: {}", e))),
        }
    }

    pub async fn predict_bkt(
        &self, 
        request: Request<crate::analytics_proto::PredictBktRequest>
    ) -> Result<Response<crate::analytics_proto::PredictBktResponse>, Status> {
        let r = request.into_inner();
        
        match crate::domain::services::bkt_service::predict_bkt(&r.user_id, &r.skill_id, &r.feature_vector, &self.pool).await {
            Ok((p_known, p_next)) => Ok(Response::new(crate::analytics_proto::PredictBktResponse { 
                p_known, 
                p_next_correct: p_next 
            })),
            Err(e) => Err(Status::internal(format!("predict bkt failed: {}", e))),
        }
    }
}
