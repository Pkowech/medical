use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use dotenvy::dotenv;
#[cfg(feature = "ml")]
use polars::frame::DataFrame;
#[cfg(feature = "ml")]
use polars::prelude::*;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use std::env;
use tonic::transport::Server;

// Import modules
pub mod api;
pub mod application;
pub mod config;
pub mod domain;
pub mod infrastructure;
pub mod modules;
#[cfg(feature = "ml")]
pub mod services;
pub mod observability;
pub mod shared;

// Re-export commonly used items
pub use shared::error::{AnalyticsError, Result};
pub use infrastructure::database::init_pool;
pub use api::middleware::Auth;
pub use api::middleware::auth::validate_token;
#[cfg(feature = "ml")]
pub use modules::analytics;

// Import generated gRPC code (disabled due to tonic compatibility)
pub mod analytics_proto {
    tonic::include_proto!("analytics");
}
use analytics_proto::analytics_service_server::AnalyticsServiceServer;
use crate::api::grpc::MyAnalyticsService;
use crate::observability::metrics as obs_metrics;

fn required_env(name: &str) -> std::io::Result<String> {
    env::var(name).map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("{name} must be configured"),
        )
    })
}

fn required_port(name: &str) -> std::io::Result<u16> {
    required_env(name)?.parse().map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            format!("{name} must be a valid port number"),
        )
    })
}

// Define request and response structs for NestJS communication
#[derive(Debug, Serialize, Deserialize)]
pub struct UserIdRequest {
    #[serde(rename = "userId")]
    pub user_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserSkillRequest {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "skillId")]
    pub skill_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct AssessmentIdRequest {
    pub assessment_id: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct LimitRequest {
    pub limit: i32,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct UserIdsRequest {
    pub user_ids: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct TrainingDataRequest {
    #[serde(rename = "userId")]
    pub user_id: Option<String>,
    pub inputs: Vec<Vec<f64>>,
    pub labels: Vec<f64>,
}

const BURN_MODEL_FEATURE_NAMES: [&str; 8] = [
    "completed_materials",
    "average_score",
    "study_time",
    "difficulty_preference",
    "learning_style",
    "engagement_level",
    "quiz_performance",
    "material_interaction",
];

#[derive(Debug, Serialize, Deserialize)]
pub struct KnowledgeGapsRequest {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "knowledgeGaps")]
    pub knowledge_gaps: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuizHistoryRequest {
    #[serde(rename = "userId")]
    pub user_id: String,
    pub options: Option<QuizHistoryOptions>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct QuizHistoryOptions {
    pub limit: Option<i32>,
    pub offset: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ProgressRecordsRequest {
    pub start: String,
    pub end: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PredictionRequest {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "modelId")]
    pub model_id: Option<String>,
    pub features: Vec<f64>,
}

// --- Handlers for NestJS calls (Actix-web) ---
// ... (existing actix-web handlers) ...

#[cfg(feature = "ml")]
async fn predict_success_rate_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<PredictionRequest>,
) -> impl Responder {
    let user_id = match uuid::Uuid::parse_str(&req.user_id) {
        Ok(user_id) => user_id,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "userId must be a UUID"}))
        }
    };
    if req.features.len() != BURN_MODEL_FEATURE_NAMES.len() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "error": format!("Exactly {} model features are required", BURN_MODEL_FEATURE_NAMES.len())
        }));
    }

    let input = req.features.iter().map(|value| *value as f32).collect();
    let model_id = match req.model_id.as_deref() {
        Some(id) => match uuid::Uuid::parse_str(id) {
            Ok(id) => Some(id),
            Err(_) => {
                return HttpResponse::BadRequest()
                    .json(serde_json::json!({"error": "modelId must be a UUID"}))
            }
        },
        None => None,
    };
    let model_id = model_id.unwrap_or(user_id);
    let model_path = match sqlx::query_scalar::<_, String>(
        r#"SELECT path FROM ml_models
           WHERE id = $1 AND is_active = TRUE AND "type" = $2"#,
    )
    .bind(model_id.to_string())
    .bind("logistic_regression")
    .fetch_optional(pool.get_ref())
    .await
    {
        Ok(Some(path)) => path,
        Ok(None) => {
            return HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "No active trained prediction model is registered for this user or modelId"
            }))
        }
        Err(error) => {
            eprintln!("Failed to resolve prediction model: {error}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to resolve prediction model"
            }));
        }
    };
    match crate::modules::analytics::models::burn_model::predict_with_saved_model(input, &model_path) {
        Ok(prediction) => HttpResponse::Ok().json(serde_json::json!({
            "userId": user_id.to_string(),
            "modelId": model_id.to_string(),
            "predictionType": "trained_logistic_regression",
            "probability": prediction[0],
            "modelVersion": "saved-model"
        })),
        Err(error) => {
            eprintln!("Success-rate prediction unavailable: {error}");
            HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "No compatible trained prediction model is available"
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn get_recommendations_ai_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserIdRequest>,
) -> impl Responder {
    // Authentication is handled by middleware (JWT or x-api-key)
    match crate::domain::services::get_recommendations_ai(&req.user_id, pool.get_ref()).await {
        Ok(recommendations) => HttpResponse::Ok().json(recommendations),
        Err(e) => {
            eprintln!("Error generating recommendations: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to generate recommendations",
                "details": e
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn train_model_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<TrainingDataRequest>,
) -> impl Responder {
    if req.inputs.len() < 2
        || req.inputs.len() != req.labels.len()
        || req
            .inputs
            .iter()
            .any(|features| features.len() != BURN_MODEL_FEATURE_NAMES.len())
    {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "code": "invalid_payload",
            "message": format!(
                "Training requires at least two labeled examples with exactly {} features",
                BURN_MODEL_FEATURE_NAMES.len()
            ),
        }));
    }

    let user_id = match req.user_id.as_deref() {
        Some(value) => match uuid::Uuid::parse_str(value) {
            Ok(user_id) => Some(user_id),
            Err(_) => {
                return HttpResponse::BadRequest()
                    .json(serde_json::json!({"error": "userId must be a UUID"}))
            }
        },
        None => None,
    };
    let inputs: Vec<Vec<f32>> = req
        .inputs
        .iter()
        .map(|features| features.iter().map(|value| *value as f32).collect())
        .collect();
    let labels: Vec<f32> = req.labels.iter().map(|label| *label as f32).collect();
    let (weights, bias) =
        match crate::modules::analytics::models::burn_model::train_linear_model(
            inputs,
            labels,
            1000,
            0.001,
        ) {
            Some(model) => model,
            None => {
                return HttpResponse::BadRequest().json(serde_json::json!({
                    "code": "invalid_training_data",
                    "message": "Features and labels must be finite and labels must be probabilities from 0 to 1",
                }))
            }
        };

    let model_id = user_id.unwrap_or_else(uuid::Uuid::new_v4);
    let model_path = format!("models/burn/{model_id}.mdl");
    if let Err(error) = std::fs::create_dir_all("models/burn") {
        eprintln!("Failed to create model directory: {error}");
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to prepare model storage"
        }));
    }
    if let Err(error) =
        crate::modules::analytics::models::burn_model::save_model(&model_path, &weights, bias)
    {
        eprintln!("Failed to save trained model: {error}");
        return HttpResponse::InternalServerError().json(serde_json::json!({
            "error": "Failed to save trained model"
        }));
    }

    let id = model_id.to_string();
    let name = format!("trained_model_{model_id}");
    let insert = sqlx::query!(
        r#"
        INSERT INTO ml_models (id, name, version, "type", path, training_data_path, metrics, trained_at, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, NOW(), NOW())
        ON CONFLICT (id) DO UPDATE SET
            name = EXCLUDED.name,
            version = EXCLUDED.version,
            "type" = EXCLUDED."type",
            path = EXCLUDED.path,
            training_data_path = EXCLUDED.training_data_path,
            metrics = EXCLUDED.metrics,
            trained_at = NOW(),
            is_active = EXCLUDED.is_active,
            updated_at = NOW()
        "#,
        id,
        name,
        "1",
        "logistic_regression",
        Some(model_path.clone()),
        Option::<String>::None,
        Option::<serde_json::Value>::None,
        true,
    )
    .execute(pool.get_ref())
    .await;

    match insert {
        Ok(_) => HttpResponse::Created().json(serde_json::json!({
            "message": "Model trained and saved",
            "modelId": id,
            "userId": user_id.map(|id| id.to_string()),
            "featureNames": BURN_MODEL_FEATURE_NAMES
        })),
        Err(e) => {
            eprintln!("Failed to register trained model: {e}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to register trained model"
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn generate_predictions_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserIdRequest>,
) -> impl Responder {
    match crate::modules::analytics::performance::predictions::generate_predictions(
        &req.user_id,
        pool.get_ref(),
    )
    .await
    {
        Ok(predictions) => HttpResponse::Ok().json(predictions),
        Err(e) => {
            eprintln!("Error generating predictions: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to generate predictions",
                "details": e
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn get_collaborative_recommendations_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<LimitRequest>,
    http_req: actix_web::HttpRequest,
) -> impl Responder {
    let user_id = match http_req.headers().get("x-user-id") {
        Some(id) => match id.to_str() {
            Ok(s) => s.to_string(),
            Err(_) => return HttpResponse::BadRequest().json(serde_json::json!({"error": "Invalid x-user-id header format"})),
        },
        None => return HttpResponse::Unauthorized().json(serde_json::json!({"error": "Missing x-user-id header"})),
    };

    match crate::modules::analytics::recommendations::collaborative::get_collaborative_recommendations(
        &user_id,
        req.limit,
        pool.get_ref(),
    )
    .await
    {
        Ok(recommendations) => HttpResponse::Ok().json(recommendations),
        Err(e) => {
            eprintln!("Error generating collaborative recommendations: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to generate collaborative recommendations",
                "details": e
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn get_trending_paths_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Query<LimitRequest>,
) -> impl Responder {
    match crate::modules::analytics::recommendations::service::get_trending_paths(req.limit as i64, pool.get_ref())
        .await
    {
        Ok(trending_paths) => HttpResponse::Ok().json(trending_paths),
        Err(e) => {
            eprintln!("Error getting trending paths: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to get trending paths",
                "details": e
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn generate_study_recommendations_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<KnowledgeGapsRequest>,
) -> impl Responder {
    match crate::modules::analytics::recommendations::study_recommendations::generate_study_recommendations(
        &req.user_id,
        &req.knowledge_gaps,
        pool.get_ref(),
    )
    .await
    {
        Ok(recommendations) => HttpResponse::Ok().json(recommendations),
        Err(e) => {
            eprintln!("Error generating study recommendations: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to generate study recommendations",
                "details": e
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn generate_next_steps_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserIdRequest>,
) -> impl Responder {
    match crate::modules::analytics::recommendations::next_steps::generate_next_steps(
        &req.user_id,
        pool.get_ref(),
    )
    .await
    {
        Ok(next_steps) => HttpResponse::Ok().json(next_steps),
        Err(e) => {
            eprintln!("Error generating next steps: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to generate next steps",
                "details": e
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn generate_analytics_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserIdRequest>,
) -> impl Responder {
    match crate::modules::analytics::reports::generation::generate_analytics(
        &req.user_id,
        None,
        pool.get_ref(),
    )
    .await
    {
        Ok(analytics) => HttpResponse::Ok().json(analytics),
        Err(e) => {
            eprintln!("Error generating analytics: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to generate analytics",
                "details": e
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn get_user_performance_profile_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserIdRequest>,
) -> impl Responder {
    match crate::modules::analytics::performance::profile::get_user_performance_profile(
        &req.user_id,
        pool.get_ref(),
    )
    .await
    {
        Ok(profile) => HttpResponse::Ok().json(profile),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error: {}", e)),
    }
}

async fn prometheus_metrics_handler() -> impl Responder {
    HttpResponse::Ok()
        .content_type("text/plain; version=0.0.4")
        .body(obs_metrics::gather_metrics())
}

#[cfg(feature = "ml")]
async fn get_related_resources_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<AssessmentIdRequest>,
) -> impl Responder {
    match crate::modules::analytics::system::related_resources::get_related_resources(
        &req.assessment_id,
        pool.get_ref(),
    )
    .await
    {
        Ok(resources) => HttpResponse::Ok().json(resources),
        Err(e) => {
            eprintln!("Error getting related resources: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to get related resources",
                "details": e
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn predict_performance_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserSkillRequest>,
) -> impl Responder {
    let skill_repo = crate::infrastructure::database::repositories::PostgresSkillStateRepository::new(
        std::sync::Arc::new(pool.get_ref().clone()),
    );
    let quiz_repo = crate::infrastructure::database::repositories::quiz_repository::PostgresQuizRepository::new(
        std::sync::Arc::new(pool.get_ref().clone()),
    );
    let use_case = crate::application::use_cases::performance::PredictPerformanceUseCase::new(
        skill_repo,
        quiz_repo,
    );
    let request = crate::application::use_cases::performance::PredictPerformanceRequest {
        user_id: req.user_id.clone(),
        skill_id: req.skill_id.clone(),
    };

    match use_case.execute(request).await {
        Ok(prediction) => HttpResponse::Ok().json(serde_json::json!({
            "userId": req.user_id,
            "skillId": req.skill_id,
            "predictedSuccessRate": prediction.score,
            "method": "bkt_with_recent_quiz_history"
        })),
        Err(error) => {
            eprintln!("Error predicting user performance: {error}");
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to predict user performance"
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn get_performance_analytics_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserIdRequest>,
) -> impl Responder {
    match crate::domain::services::get_performance_analytics(&req.user_id, None, pool.get_ref()).await {
        Ok(analytics) => HttpResponse::Ok().json(analytics),
        Err(e) => {
            eprintln!("Error getting performance analytics: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to get performance analytics",
                "details": e
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn calculate_performance_metrics_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserIdsRequest>,
) -> impl Responder {
    // Assuming NestJS sends a single userId for now, or Rust handles multiple.
    // The Rust function expects &str, so taking the first one.
    let user_id = &req.user_ids[0];
    match crate::modules::analytics::performance::metrics::calculate_performance_metrics(
        user_id,
        pool.get_ref(),
    )
    .await
    {
        Ok(metrics) => HttpResponse::Ok().json(metrics),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error: {}", e)),
    }
}

#[cfg(feature = "ml")]
async fn analyze_study_patterns_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserIdRequest>,
) -> impl Responder {
    let learning_history =
        match crate::modules::analytics::data::get_learning_history(&req.user_id, pool.get_ref()).await {
            Ok(history) => history,
            Err(e) => {
                eprintln!("Error fetching learning history: {}", e);
                return HttpResponse::InternalServerError().json(serde_json::json!({
                    "error": "Failed to fetch learning history",
                    "details": e.to_string()
                }));
            }
        };

    let study_items: Vec<_> = learning_history
        .iter()
        .filter(|item| {
            item.item_type.as_ref().map(|t| t.as_str()) == Some("study") && item.duration.is_some()
        })
        .collect();

    let quiz_items: Vec<_> = learning_history
        .iter()
        .filter(|item| {
            item.item_type.as_ref().map(|t| t.as_str()) == Some("quiz") && item.score.is_some()
        })
        .collect();

    if study_items.is_empty() && quiz_items.is_empty() {
        return HttpResponse::Ok().json(serde_json::json!({
            "userId": req.user_id,
            "message": "No learning history found"
        }));
    }

    let study_minutes: Vec<f64> = study_items
        .iter()
        .filter_map(|item| item.duration.map(|d| d as f64))
        .collect();

    let quiz_scores: Vec<f64> = quiz_items.iter().filter_map(|item| item.score).collect();

    let study_df = match DataFrame::new(vec![Series::new("minutes".into(), &study_minutes).into()])
    {
        Ok(df) => df,
        Err(e) => {
            eprintln!("Error creating study dataframe: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to process study data"
            }));
        }
    };

    let quizzes_df = match DataFrame::new(vec![Series::new("score".into(), &quiz_scores).into()]) {
        Ok(df) => df,
        Err(e) => {
            eprintln!("Error creating quiz dataframe: {}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to process quiz data"
            }));
        }
    };

    let patterns = crate::modules::analytics::engagement::learning_patterns::analyze_learning_patterns(
        &study_df,
        &quizzes_df,
    );
    HttpResponse::Ok().json(patterns)
}

#[cfg(feature = "ml")]
async fn get_quiz_attempt_history_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<QuizHistoryRequest>,
) -> impl Responder {
    match crate::modules::analytics::engagement::quiz_history::get_quiz_attempt_history(
        &req.user_id,
        req.options.as_ref().and_then(|o| o.limit),
        req.options.as_ref().and_then(|o| o.offset),
        pool.get_ref(),
    )
    .await
    {
        Ok(history) => HttpResponse::Ok().json(history),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error: {}", e)),
    }
}

#[cfg(feature = "ml")]
async fn get_path_analytics_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<AssessmentIdRequest>,
) -> impl Responder {
    match crate::modules::analytics::reports::path_analytics::get_path_analytics(
        &req.assessment_id,
        pool.get_ref(),
    )
    .await
    {
        Ok(analytics) => HttpResponse::Ok().json(analytics),
        Err(e) => {
            eprintln!("Error getting path analytics: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to get path analytics",
                "details": format!("{}", e)
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn get_system_analytics_handler(pool: web::Data<Pool<Postgres>>) -> impl Responder {
    match crate::modules::analytics::system::analytics::get_system_analytics(pool.get_ref()).await {
        Ok(analytics) => HttpResponse::Ok().json(analytics),
        Err(e) => HttpResponse::InternalServerError().body(format!("Error: {}", e)),
    }
}

#[cfg(feature = "ml")]
async fn get_progress_records_for_period_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<ProgressRecordsRequest>,
) -> impl Responder {
    match crate::modules::analytics::performance::records::get_progress_records(
        &req.start,
        &req.end,
        pool.get_ref(),
    )
    .await
    {
        Ok(records) => HttpResponse::Ok().json(records),
        Err(e) => {
            eprintln!("Error getting progress records: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to get progress records",
                "details": e
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn process_analytics_for_users_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserIdsRequest>,
) -> impl Responder {
    let response = match crate::modules::analytics::core::batch_processing::process_analytics_for_users(
        pool.get_ref(),
        &req.user_ids,
    )
    .await
    {
        Ok(result) => HttpResponse::Ok().json(result),
        Err(e) => {
            eprintln!("Error processing analytics: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to process analytics",
                "details": e
            }))
        }
    };

    // Update aggregated BKT skill average metrics after processing
    if let Err(err) = crate::modules::analytics::core::batch_processing::update_bkt_skill_avg_metrics(pool.get_ref()).await {
        eprintln!("Failed to update BKT skill averages metrics: {}", err);
    }

    response
}

#[cfg(feature = "ml")]
async fn get_user_engagement_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserIdRequest>,
) -> impl Responder {
    match crate::modules::analytics::engagement::user_engagement::get_user_engagement(
        &req.user_id,
        pool.get_ref(),
    )
    .await
    {
        Ok(engagement) => HttpResponse::Ok().json(engagement),
        Err(e) => {
            eprintln!("Error getting user engagement: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to get user engagement",
                "details": e
            }))
        }
    }
}

#[cfg(feature = "ml")]
async fn predict_with_burn_handler(
    pool: web::Data<Pool<Postgres>>,
    req: web::Json<UserIdRequest>,
) -> impl Responder {
    let user_id = match uuid::Uuid::parse_str(&req.user_id) {
        Ok(user_id) => user_id,
        Err(_) => {
            return HttpResponse::BadRequest()
                .json(serde_json::json!({"error": "userId must be a UUID"}))
        }
    };
    let features = match crate::modules::analytics::core::feature_extraction::extract_user_features(
        user_id.to_string(),
        pool.get_ref(),
    )
    .await
    {
        Ok(features) => features,
        Err(error) => {
            eprintln!("Failed to extract prediction features: {error}");
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to extract prediction features"
            }));
        }
    };

    let input = vec![
        features.completed_materials as f32,
        features.average_score as f32,
        features.study_time as f32,
        features.difficulty_preference as f32,
        features.learning_style as f32,
        features.engagement_level as f32,
        features.quiz_performance as f32,
        features.material_interaction as f32,
    ];
    let model_path = format!("models/burn/{user_id}.mdl");
    match crate::modules::analytics::models::burn_model::predict_with_saved_model(input, &model_path)
    {
        Ok(prediction) => HttpResponse::Ok().json(serde_json::json!({
            "userId": user_id.to_string(),
            "predictionType": "trained_logistic_regression",
            "predictedSuccessRate": prediction[0],
            "modelVersion": "saved-model"
        })),
        Err(error) => {
            eprintln!("Burn model prediction unavailable: {error}");
            HttpResponse::ServiceUnavailable().json(serde_json::json!({
                "error": "No compatible trained prediction model is available"
            }))
        }
    }
}

async fn health_check_handler() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

pub async fn run() -> std::io::Result<()> {
    dotenv().ok();

    let pool = init_pool().await.expect("Failed to create pool");

    // gRPC Server
    let grpc_api_key = env::var("RUST_ANALYTICS_API_KEY")
        .ok()
        .filter(|key| !key.trim().is_empty())
        .ok_or_else(|| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "RUST_ANALYTICS_API_KEY must be configured to enable gRPC",
            )
        })?;
    let grpc_pool = pool.clone();
    let grpc_host = required_env("RUST_ANALYTICS_GRPC_HOST")?;
    let grpc_port = required_port("RUST_ANALYTICS_GRPC_PORT")?;
    let grpc_addr = format!("{grpc_host}:{grpc_port}").parse().map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "RUST_ANALYTICS_GRPC_HOST and RUST_ANALYTICS_GRPC_PORT must form a valid socket address",
        )
    })?;
    let analytics_service = MyAnalyticsService::new(grpc_pool);
    let (grpc_shutdown_tx, grpc_shutdown_rx) = tokio::sync::oneshot::channel();

    let grpc_server = tokio::spawn(async move {
        println!("gRPC server listening on {}", grpc_addr);
        let auth_interceptor = move |request: tonic::Request<()>| {
            let supplied_key = request
                .metadata()
                .get("x-api-key")
                .and_then(|value| value.to_str().ok());

            if supplied_key == Some(grpc_api_key.as_str()) {
                Ok(request)
            } else {
                Err(tonic::Status::unauthenticated(
                    "Missing or invalid analytics API key",
                ))
            }
        };

        Server::builder()
            .add_service(AnalyticsServiceServer::with_interceptor(
                analytics_service,
                auth_interceptor,
            ))
            .serve_with_shutdown(grpc_addr, async {
                let _ = grpc_shutdown_rx.await;
            })
            .await
    });

    // Actix-web Server
    println!("Configuring HTTP server...");
    let http_host = required_env("RUST_ANALYTICS_HOST")?;
    let http_port = env::var("RUST_ANALYTICS_PORT")
        .or_else(|_| env::var("PORT"))
        .map_err(|_| {
            std::io::Error::new(
                std::io::ErrorKind::InvalidInput,
                "PORT or RUST_ANALYTICS_PORT must be configured",
            )
        })?;
    http_port.parse::<u16>().map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "PORT or RUST_ANALYTICS_PORT must be a valid port number",
        )
    })?;
    let http_addr = format!("{}:{}", http_host, http_port);
    println!("HTTP server address: {}", http_addr);

    let http_server = HttpServer::new(move || {
        println!("Creating new HTTP application instance...");
        #[allow(unused_mut)]
        let mut app = App::new()
            .app_data(web::Data::new(pool.clone()))
            .wrap(crate::api::middleware::Auth)
            .service(web::resource("/health").route(web::get().to(health_check_handler)))
            .service(web::resource("/metrics").route(web::get().to(prometheus_metrics_handler)));

        #[cfg(feature = "ml")]
        {
            app = app
                .service(
                    web::resource("/recommendations/get_recommendations_ai")
                        .route(web::post().to(get_recommendations_ai_handler)),
                )
                .service(
                    web::resource("/predict-success-rate")
                        .route(web::post().to(predict_success_rate_handler)),
                )
                .service(web::resource("/train_model").route(web::post().to(train_model_handler)))
                .service(
                    web::resource("/predictions/generate_predictions")
                        .route(web::post().to(generate_predictions_handler)),
                )
                .service(
                    web::resource("/recommendations/collaborative")
                        .route(web::post().to(get_collaborative_recommendations_handler)),
                )
                .service(
                    web::resource("/recommendations/trending_paths")
                        .route(web::get().to(get_trending_paths_handler)),
                )
                .service(
                    web::resource("/recommendations/study_recommendations")
                        .route(web::post().to(generate_study_recommendations_handler)),
                )
                .service(
                    web::resource("/recommendations/next_steps")
                        .route(web::post().to(generate_next_steps_handler)),
                )
                .service(
                    web::resource("/reports/generate_analytics")
                        .route(web::post().to(generate_analytics_handler)),
                )
                .service(
                    web::resource("/performance/user_performance_profile")
                        .route(web::post().to(get_user_performance_profile_handler)),
                )
                .service(
                    web::resource("/system/related_resources")
                        .route(web::post().to(get_related_resources_handler)),
                )
                .service(
                    web::resource("/performance/prediction")
                        .route(web::post().to(predict_performance_handler)),
                )
                .service(
                    web::resource("/performance/analytics")
                        .route(web::post().to(get_performance_analytics_handler)),
                )
                .service(
                    web::resource("/performance/metrics")
                        .route(web::post().to(calculate_performance_metrics_handler)),
                )
                .service(
                    web::resource("/engagement/learning_patterns")
                        .route(web::post().to(analyze_study_patterns_handler)),
                )
                .service(
                    web::resource("/engagement/quiz_history")
                        .route(web::post().to(get_quiz_attempt_history_handler)),
                )
                .service(
                    web::resource("/reports/path_analytics")
                        .route(web::post().to(get_path_analytics_handler)),
                )
                .service(
                    web::resource("/system/analytics")
                        .route(web::post().to(get_system_analytics_handler)),
                )
                .service(
                    web::resource("/performance/records")
                        .route(web::post().to(get_progress_records_for_period_handler)),
                )
                .service(
                    web::resource("/core/batch_processing")
                        .route(web::post().to(process_analytics_for_users_handler)),
                )
                .service(
                    web::resource("/engagement/user_engagement")
                        .route(web::post().to(get_user_engagement_handler)),
                )
                .service(
                    web::resource("/models/predict_with_burn")
                        .route(web::post().to(predict_with_burn_handler)),
                );
        }

        app
    })
    .bind(&http_addr)?
    .run();
    let http_handle = http_server.handle();
    let mut http_server = tokio::spawn(http_server);

    let shutdown_result = tokio::select! {
        result = &mut http_server => match result {
            Ok(result) => result,
            Err(error) => Err(std::io::Error::other(error)),
        },
        signal_result = tokio::signal::ctrl_c() => {
            match signal_result {
                Ok(()) => {
                    println!("Shutdown signal received; stopping HTTP and gRPC servers...");
                    http_handle.stop(true).await;
                    match http_server.await {
                        Ok(result) => result,
                        Err(error) => Err(std::io::Error::other(error)),
                    }
                }
                Err(error) => {
                    http_handle.stop(false).await;
                    let _ = http_server.await;
                    Err(std::io::Error::other(error))
                }
            }
        }
    };

    let _ = grpc_shutdown_tx.send(());
    let grpc_result = match grpc_server.await {
        Ok(Ok(())) => Ok(()),
        Ok(Err(error)) => Err(std::io::Error::other(error)),
        Err(error) => Err(std::io::Error::other(error)),
    };

    shutdown_result?;
    grpc_result
}
