use crate::analytics_proto::{
    AnalyzeQuestionDifficultyRequest, AnalyzeQuestionDifficultyResponse, PredictPerformanceRequest,
    PredictPerformanceResponse, UpdateBktRequest, UpdateBktResponse,
};
use crate::application::use_cases::performance::{
    PredictPerformanceRequest as AppPredictPerformanceRequest, PredictPerformanceUseCase,
    UpdateBktRequest as AppUpdateBktRequest, UpdateBktUseCase,
};
use crate::infrastructure::database::repositories::PostgresSkillStateRepository;
use sqlx::{Pool, Postgres, Row};
use std::sync::Arc;
use tonic::{Request, Response, Status};

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

    pub async fn analyze_question_difficulty(
        &self,
        request: Request<AnalyzeQuestionDifficultyRequest>,
    ) -> Result<Response<AnalyzeQuestionDifficultyResponse>, Status> {
        let request = request.into_inner();
        if request.user_id.is_empty() {
            return Err(Status::invalid_argument("user_id cannot be empty"));
        }
        if request.question_id.is_empty() {
            return Err(Status::invalid_argument("question_id cannot be empty"));
        }

        let question = sqlx::query(
            "SELECT difficulty::text AS difficulty, difficulty_index \
             FROM questions WHERE id = $1 AND is_active = TRUE",
        )
        .bind(&request.question_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Failed to load question: {error}")))?
        .ok_or_else(|| Status::not_found("Question was not found or is inactive"))?;

        let difficulty: String = question
            .try_get("difficulty")
            .map_err(|error| Status::internal(format!("Invalid question difficulty: {error}")))?;
        let difficulty_index: Option<f64> = question
            .try_get("difficulty_index")
            .map_err(|error| Status::internal(format!("Invalid difficulty index: {error}")))?;
        let base_difficulty = match difficulty_index.filter(|value| value.is_finite()) {
            Some(value) => value.clamp(0.0, 1.0),
            None => match difficulty.as_str() {
                "easy" => 0.3,
                "medium" => 0.5,
                "hard" => 0.7,
                _ => {
                    return Err(Status::internal(format!(
                        "Unsupported question difficulty: {difficulty}"
                    )));
                }
            },
        };

        let history = sqlx::query(
            r#"
            SELECT COUNT(*) AS sample_size,
                   AVG(answered_response.is_correct::int)::float8 AS accuracy
            FROM user_responses answered_response
            JOIN questions answered_question
              ON answered_question.id = answered_response.question_id
            JOIN questions target_question
              ON target_question.id = $2
            WHERE answered_response.user_id = $1
              AND answered_response.question_id <> $2
              AND (
                  target_question.topic_ids && answered_question.topic_ids
                  OR (
                      cardinality(target_question.topic_ids) = 0
                      AND target_question.category = answered_question.category
                  )
              )
            "#,
        )
        .bind(&request.user_id)
        .bind(&request.question_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Failed to load learner history: {error}")))?;

        let sample_size: i64 = history
            .try_get("sample_size")
            .map_err(|error| Status::internal(format!("Invalid history sample size: {error}")))?;
        let accuracy: Option<f64> = history
            .try_get("accuracy")
            .map_err(|error| Status::internal(format!("Invalid learner accuracy: {error}")))?;
        let difficulty_score = match accuracy.filter(|_| sample_size > 0) {
            Some(value) if value.is_finite() => {
                (base_difficulty * 0.6 + (1.0 - value.clamp(0.0, 1.0)) * 0.4).clamp(0.0, 1.0)
            }
            _ => base_difficulty,
        };
        let accuracy =
            if sample_size > 0 {
                Some(accuracy.ok_or_else(|| {
                    Status::internal("Question history has samples but no accuracy")
                })?)
            } else {
                None
            };
        let suggestion = if sample_size < 3 {
            format!(
                "Limited topic history ({sample_size} prior responses); estimate is primarily based on the question's tagged difficulty."
            )
        } else if accuracy.is_some_and(|value| value < 0.4) {
            "Learner history suggests this topic is currently challenging.".to_string()
        } else if accuracy.is_some_and(|value| value >= 0.8) {
            "Learner history suggests this topic is currently manageable.".to_string()
        } else {
            "Learner history suggests a moderate challenge for this topic.".to_string()
        };
        let sample_size = i32::try_from(sample_size)
            .map_err(|error| Status::internal(format!("History sample size overflow: {error}")))?;

        Ok(Response::new(AnalyzeQuestionDifficultyResponse {
            difficulty_score,
            suggestion,
            sample_size,
        }))
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

        let app_req = AppPredictPerformanceRequest {
            user_id: user_id.clone(),
            skill_id: skill_id.clone(),
        };
        let result = use_case
            .execute(app_req)
            .await
            .map_err(|e| Status::internal(format!("Prediction failed: {}", e)))?;

        Ok(Response::new(PredictPerformanceResponse {
            score: result.score,
        }))
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

        let app_req = AppUpdateBktRequest {
            user_id: user_id.clone(),
            skill_id: skill_id.clone(),
            is_correct,
        };
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
        request: Request<crate::analytics_proto::PredictBurnRequest>,
    ) -> Result<Response<crate::analytics_proto::PredictBurnResponse>, Status> {
        let r = request.into_inner();

        let user_id = uuid::Uuid::parse_str(&r.user_id)
            .map_err(|_| Status::invalid_argument("user_id must be a UUID"))?;
        let model_path = format!("models/burn/{user_id}.mdl");
        let features_f32: Vec<f32> = r.features.iter().map(|v| *v as f32).collect();
        let (score, version) =
            crate::domain::services::burn_model_service::predict_with_saved_model(
                &r.user_id,
                features_f32,
                &model_path,
            )
            .map_err(Status::failed_precondition)?;
        Ok(Response::new(crate::analytics_proto::PredictBurnResponse {
            retention_score: score as f64,
            model_version: version,
        }))
    }

    pub async fn update_bkt_skill_metrics(
        &self,
        request: Request<()>,
    ) -> Result<Response<crate::analytics_proto::UpdateBktSkillMetricsResponse>, Status> {
        let _req = request.into_inner();

        match crate::modules::analytics::core::batch_processing::update_bkt_skill_avg_metrics(
            &self.pool,
        )
        .await
        {
            Ok(_) => Ok(Response::new(
                crate::analytics_proto::UpdateBktSkillMetricsResponse {
                    success: true,
                    message: "BKT skill metrics updated successfully".to_string(),
                },
            )),
            Err(e) => Err(Status::internal(format!(
                "Failed to update BKT metrics: {}",
                e
            ))),
        }
    }

    pub async fn predict_bkt(
        &self,
        request: Request<crate::analytics_proto::PredictBktRequest>,
    ) -> Result<Response<crate::analytics_proto::PredictBktResponse>, Status> {
        let r = request.into_inner();

        match crate::domain::services::bkt_service::predict_bkt(
            &r.user_id,
            &r.skill_id,
            &r.feature_vector,
            &self.pool,
        )
        .await
        {
            Ok((p_known, p_next)) => {
                Ok(Response::new(crate::analytics_proto::PredictBktResponse {
                    p_known,
                    p_next_correct: p_next,
                }))
            }
            Err(e) => Err(Status::internal(format!("predict bkt failed: {}", e))),
        }
    }
}
