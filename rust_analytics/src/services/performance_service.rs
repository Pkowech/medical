use crate::analytics_proto::{
    AnalyzeQuestionDifficultyRequest, AnalyzeQuestionDifficultyResponse,
    AssessmentCategoryBreakdown, AssessmentDifficultyBreakdown, AssessmentLearningTrend,
    AssessmentPerformanceAnalyticsRequest, AssessmentPerformanceAnalyticsResponse,
    PredictPerformanceRequest, PredictPerformanceResponse, UpdateBktRequest, UpdateBktResponse,
};
use crate::application::use_cases::performance::{
    PredictPerformanceRequest as AppPredictPerformanceRequest, PredictPerformanceUseCase,
    UpdateBktRequest as AppUpdateBktRequest, UpdateBktUseCase,
};
use crate::infrastructure::database::repositories::PostgresSkillStateRepository;
use sqlx::{Pool, Postgres, Row};
use std::collections::HashMap;
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

    pub async fn get_assessment_performance_analytics(
        &self,
        request: Request<AssessmentPerformanceAnalyticsRequest>,
    ) -> Result<Response<AssessmentPerformanceAnalyticsResponse>, Status> {
        let request = request.into_inner();
        if request.user_id.is_empty() {
            return Err(Status::invalid_argument("user_id cannot be empty"));
        }

        let quiz_id = if request.quiz_id.is_empty() {
            None
        } else {
            Some(request.quiz_id.as_str())
        };
        let aggregate = sqlx::query(
            "SELECT COUNT(*)::bigint AS total_attempts,
                    COALESCE(AVG(COALESCE(percentage, score)), 0)::double precision AS average_score,
                    COALESCE(SUM(total_questions), 0)::bigint AS questions_attempted,
                    COALESCE(SUM(correct_answers), 0)::bigint AS correct_answers,
                    COALESCE(SUM(time_taken), 0)::bigint AS time_taken
             FROM quiz_attempts
             WHERE user_id = $1
               AND completed_at IS NOT NULL
               AND ($2::text IS NULL OR quiz_id = $2)",
        )
        .bind(&request.user_id)
        .bind(quiz_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| {
            Status::internal(format!("Failed to aggregate assessment performance: {error}"))
        })?;

        let total_attempts: i64 = aggregate
            .try_get("total_attempts")
            .map_err(|error| Status::internal(format!("Invalid attempt count: {error}")))?;
        let average_score: f64 = aggregate
            .try_get("average_score")
            .map_err(|error| Status::internal(format!("Invalid average score: {error}")))?;
        let questions_attempted: i64 = aggregate
            .try_get("questions_attempted")
            .map_err(|error| Status::internal(format!("Invalid question count: {error}")))?;
        let correct_answers: i64 = aggregate
            .try_get("correct_answers")
            .map_err(|error| Status::internal(format!("Invalid correct answer count: {error}")))?;
        let time_taken: i64 = aggregate
            .try_get("time_taken")
            .map_err(|error| Status::internal(format!("Invalid time taken: {error}")))?;

        let attempts_filter =
            "user_id = $1 AND completed_at IS NOT NULL AND ($2::text IS NULL OR quiz_id = $2)";
        let recent_scores: Vec<f64> = sqlx::query_scalar(&format!(
            "SELECT COALESCE(percentage, score)::double precision
             FROM quiz_attempts WHERE {attempts_filter}
             ORDER BY started_at DESC LIMIT 5"
        ))
        .bind(&request.user_id)
        .bind(quiz_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Failed to load recent scores: {error}")))?;

        let trend_rows = sqlx::query(&format!(
            "SELECT to_char(started_at, 'YYYY-MM-DD\"T\"HH24:MI:SS.MS\"Z\"') AS date,
                    COALESCE(percentage, score)::double precision AS score
             FROM quiz_attempts WHERE {attempts_filter}
             ORDER BY started_at DESC"
        ))
        .bind(&request.user_id)
        .bind(quiz_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Failed to load learning trends: {error}")))?;
        let mut learning_trends = Vec::with_capacity(trend_rows.len());
        let mut progress_trend = HashMap::new();
        for row in trend_rows {
            let date: String = row
                .try_get("date")
                .map_err(|error| Status::internal(format!("Invalid trend date: {error}")))?;
            let score: f64 = row
                .try_get("score")
                .map_err(|error| Status::internal(format!("Invalid trend score: {error}")))?;
            progress_trend.entry(date.clone()).or_insert(score);
            learning_trends.push(AssessmentLearningTrend { date, score });
        }

        let category_rows = sqlx::query(
            "SELECT q.category::text AS category,
                    COUNT(*)::bigint AS total,
                    COUNT(*) FILTER (WHERE ur.is_correct)::bigint AS correct,
                    AVG(COALESCE(ur.response_time, 0))::double precision AS average_time
             FROM user_responses ur
             JOIN quiz_attempts qa ON qa.id = ur.attempt_id
             JOIN questions q ON q.id = ur.question_id
             WHERE qa.user_id = $1
               AND ur.user_id = $1
               AND qa.completed_at IS NOT NULL
               AND ($2::text IS NULL OR qa.quiz_id = $2)
             GROUP BY q.category
             ORDER BY q.category::text",
        )
        .bind(&request.user_id)
        .bind(quiz_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| {
            Status::internal(format!("Failed to aggregate category performance: {error}"))
        })?;
        let mut category_breakdown = Vec::with_capacity(category_rows.len());
        let mut strengths = Vec::new();
        let mut weaknesses = Vec::new();
        for row in category_rows {
            let raw_category: String = row
                .try_get("category")
                .map_err(|error| Status::internal(format!("Invalid category: {error}")))?;
            let total: i64 = row
                .try_get("total")
                .map_err(|error| Status::internal(format!("Invalid category count: {error}")))?;
            let correct: i64 = row
                .try_get("correct")
                .map_err(|error| Status::internal(format!("Invalid category score: {error}")))?;
            let average_time: f64 = row
                .try_get("average_time")
                .map_err(|error| Status::internal(format!("Invalid category time: {error}")))?;
            let category = raw_category
                .split('_')
                .map(|part| {
                    let mut chars = part.chars();
                    match chars.next() {
                        Some(first) => first.to_uppercase().chain(chars).collect::<String>(),
                        None => String::new(),
                    }
                })
                .collect::<Vec<_>>()
                .join(" ");
            let score = if total > 0 {
                correct as f64 / total as f64 * 100.0
            } else {
                0.0
            };
            let is_strength = score >= 80.0;
            let is_weakness = score < 60.0;
            if is_strength {
                strengths.push(category.clone());
            }
            if is_weakness {
                weaknesses.push(category.clone());
            }
            category_breakdown.push(AssessmentCategoryBreakdown {
                category,
                score,
                questions_answered: i32::try_from(total).map_err(|error| {
                    Status::internal(format!("Category question count overflow: {error}"))
                })?,
                average_time,
                is_strength,
                is_weakness,
                correct: i32::try_from(correct).map_err(|error| {
                    Status::internal(format!("Category correct count overflow: {error}"))
                })?,
                total: i32::try_from(total).map_err(|error| {
                    Status::internal(format!("Category total count overflow: {error}"))
                })?,
            });
        }

        let difficulty_rows = sqlx::query(
            "SELECT q.difficulty::text AS difficulty,
                    COUNT(*) FILTER (WHERE ur.is_correct)::bigint AS correct_answers
             FROM user_responses ur
             JOIN quiz_attempts qa ON qa.id = ur.attempt_id
             JOIN questions q ON q.id = ur.question_id
             WHERE qa.user_id = $1
               AND ur.user_id = $1
               AND qa.completed_at IS NOT NULL
               AND ($2::text IS NULL OR qa.quiz_id = $2)
             GROUP BY q.difficulty
             ORDER BY q.difficulty::text",
        )
        .bind(&request.user_id)
        .bind(quiz_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| {
            Status::internal(format!(
                "Failed to aggregate difficulty performance: {error}"
            ))
        })?;
        let mut difficulty_breakdown = Vec::with_capacity(difficulty_rows.len());
        for row in difficulty_rows {
            let difficulty: String = row
                .try_get("difficulty")
                .map_err(|error| Status::internal(format!("Invalid difficulty: {error}")))?;
            let correct: i64 = row.try_get("correct_answers").map_err(|error| {
                Status::internal(format!("Invalid difficulty answer count: {error}"))
            })?;
            let correct = i32::try_from(correct).map_err(|error| {
                Status::internal(format!("Difficulty answer count overflow: {error}"))
            })?;
            difficulty_breakdown.push(AssessmentDifficultyBreakdown {
                difficulty,
                correct_answers: correct,
            });
        }

        let total_attempts = i32::try_from(total_attempts)
            .map_err(|error| Status::internal(format!("Attempt count overflow: {error}")))?;
        let questions_attempted = i32::try_from(questions_attempted)
            .map_err(|error| Status::internal(format!("Question count overflow: {error}")))?;
        let correct_answers = i32::try_from(correct_answers)
            .map_err(|error| Status::internal(format!("Correct answer count overflow: {error}")))?;
        let time_spent_minutes = time_taken / 60 + i64::from(time_taken % 60 >= 30);
        let time_spent = i32::try_from(time_spent_minutes)
            .map_err(|error| Status::internal(format!("Time spent overflow: {error}")))?;
        let time_per_question = if questions_attempted > 0 {
            (time_taken as f64 / questions_attempted as f64 * 100.0).round() / 100.0
        } else {
            0.0
        };

        Ok(Response::new(AssessmentPerformanceAnalyticsResponse {
            user_id: request.user_id,
            quiz_id: quiz_id.unwrap_or_default().to_string(),
            overall_score: average_score,
            average_score,
            recent_scores,
            questions_attempted,
            correct_answers,
            time_taken,
            time_spent,
            time_per_question,
            total_attempts,
            category_breakdown,
            learning_trends,
            strengths,
            weaknesses,
            difficulty_breakdown,
            progress_trend,
            average_time_per_question: time_per_question,
        }))
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
