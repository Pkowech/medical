use actix_web::{web, App, HttpResponse, HttpServer, Responder};
use dotenvy::dotenv;
#[cfg(feature = "ml")]
use ndarray::array;
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

// Define request and response structs for NestJS communication
#[derive(Debug, Serialize, Deserialize)]
pub struct UserIdRequest {
    #[serde(rename = "userId")]
    pub user_id: String,
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
    pub inputs: Vec<Vec<f64>>,
    pub labels: Vec<f64>,
}

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
    pub features: Vec<f64>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PredictionResponse {
    #[serde(rename = "userId")]
    pub user_id: String,
    #[serde(rename = "type")]
    pub prediction_type: String, // Corresponds to PredictionType.successProbability
    pub probability: f64,
    pub confidence: f64,
    pub factors: Vec<String>,
    #[serde(rename = "predictedSuccessRate")]
    pub predicted_success_rate: f64,
    #[serde(rename = "recommendedStudyTime")]
    pub recommended_study_time: i64,
}

fn calculate_variance(arr: &[f64]) -> f64 {
    if arr.is_empty() {
        return 0.0;
    }
    let mean: f64 = arr.iter().sum::<f64>() / arr.len() as f64;
    let variance: f64 = arr.iter().map(|&v| (v - mean).powi(2)).sum::<f64>() / arr.len() as f64;
    variance
}

// --- Handlers for NestJS calls (Actix-web) ---
// ... (existing actix-web handlers) ...

#[cfg(feature = "ml")]
async fn predict_success_rate_handler(req: web::Json<PredictionRequest>) -> impl Responder {
    let predicted_success_rate = if !req.features.is_empty() {
        req.features[0].min(1.0).max(0.0)
    } else {
        0.5
    };

    let variance = if req.features.len() > 1 {
        calculate_variance(&req.features)
    } else {
        0.1
    };
    let confidence = (1.0 - variance).min(0.95).max(0.5);

    let resp = PredictionResponse {
        user_id: req.user_id.clone(),
        prediction_type: "successProbability".to_string(), // Corresponds to PredictionType.successProbability
        probability: predicted_success_rate,
        confidence,
        factors: vec!["feature_based_estimate".to_string()],
        predicted_success_rate,
        recommended_study_time: ((30.0 + (1.0 - predicted_success_rate) * 60.0) as f64).round()
            as i64,
    };

    HttpResponse::Ok().json(resp)
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
    // Authentication is handled by middleware (JWT or x-api-key)
    // Basic validation of payload
    if req.inputs.is_empty() || req.labels.is_empty() {
        return HttpResponse::BadRequest().json(serde_json::json!({
            "code": "invalid_payload",
            "message": "Training inputs and labels must be provided",
        }));
    }

    println!(
        "Received training data: inputs count = {}, labels count = {}",
        req.inputs.len(),
        req.labels.len()
    );

    // Insert a record into ml_models to represent the training job (placeholder)
    let id = format!(
        "model_{}",
        chrono::Utc::now().timestamp_nanos_opt().unwrap()
    );
    let name = format!(
        "uploaded_model_{}",
        chrono::Utc::now().format("%Y%m%d%H%M%S")
    );
    let insert = sqlx::query!(
        r#"
        INSERT INTO ml_models (id, name, version, "type", path, training_data_path, metrics, trained_at, is_active, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), $8, NOW(), NOW())
        "#,
        id,
        name,
        "v0",
        "custom",
        Option::<String>::None,
        Option::<String>::None,
        Option::<serde_json::Value>::None,
        false,
    )
    .execute(pool.get_ref())
    .await;

    match insert {
        Ok(_) => HttpResponse::Accepted()
            .json(serde_json::json!({"message": "Model training job accepted", "modelId": id})),
        Err(e) => {
            eprintln!("Failed to enqueue model training record: {}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({"error": "Failed to enqueue training job", "details": format!("{}", e)}))
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
    req: web::Json<UserIdRequest>,
) -> impl Responder {
    println!("Predicting performance for user: {}", req.user_id);

    // Extract features for the user
    let user_features = match crate::modules::analytics::core::feature_extraction::extract_user_features(
        req.user_id.clone(),
        pool.get_ref(),
    )
    .await
    {
        Ok(features) => features,
        Err(e) => {
            eprintln!("Error extracting user features: {:?}", e);
            return HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to extract user features",
                "details": format!("{}", e)
            }));
        }
    };

    // Convert UserFeatures struct to a feature vector (Array2<f64>)
    let data = array![[
        user_features.completed_materials as f64,
        user_features.average_score,
        user_features.study_time as f64,
        user_features.difficulty_preference,
        user_features.learning_style,
        user_features.engagement_level,
        user_features.quiz_performance,
        user_features.material_interaction,
    ]];

    // Dummy targets for training. In a real scenario, you would have a proper training dataset.
    let targets = array![10.0, 20.0, 30.0, 40.0, 50.0, 60.0, 70.0, 80.0]; // Adjusted to match number of features

    // The model needs more data points to be meaningful, so we'll duplicate the data for now.
    let n_samples = data.shape()[0];
    let n_features = data.shape()[1];
    let mut new_data = ndarray::Array2::zeros((n_samples * 8, n_features));
    for i in 0..8 {
        let start = i * n_samples;
        let end = start + n_samples;
        new_data
            .slice_mut(ndarray::s![start..end, ..])
            .assign(&data);
    }
    let data = new_data;

    match crate::modules::analytics::performance::prediction::predict_performance(&data, &targets) {
        Ok(predictions) => {
            // For simplicity, taking the first prediction and converting it to a score
            let predicted_score = predictions.get(0).cloned().unwrap_or(0.0);
            let confidence = 0.85; // Placeholder confidence

            let resp = PredictionResponse {
                user_id: req.user_id.clone(),
                prediction_type: "linfa_prediction".to_string(),
                probability: predicted_score / 100.0, // Assuming score is out of 100
                confidence,
                factors: vec!["dummy_features".to_string()],
                predicted_success_rate: predicted_score / 100.0,
                recommended_study_time: ((60.0 - predicted_score * 0.5) as f64).round() as i64, // Example calculation
            };
            HttpResponse::Ok().json(resp)
        }
        Err(e) => {
            eprintln!("Error during linfa prediction: {:?}", e);
            HttpResponse::InternalServerError().json(serde_json::json!({
                "error": "Failed to predict performance",
                "details": format!("{}", e)
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
async fn predict_with_burn_handler(req: web::Json<PredictionRequest>) -> impl Responder {
    println!("Predicting with Burn model for user: {}", req.user_id);

    // Dummy input data for the Burn model. In a real scenario, this would come from
    // feature extraction or a database query based on req.userId.
    let input_data = vec![1.0, 2.0, 3.0, 4.0, 5.0];

    // Call the burn model's prediction function
    // Note: The Backend type needs to be specified. For simplicity, we'll use the default CPU backend.
    // In a real application, you might want to make this configurable or use a GPU backend.
    let predictions = crate::modules::analytics::models::burn_model::predict_with_linear_model::<
        burn::backend::NdArray<f32>,
    >(input_data);

    // For simplicity, taking the first prediction
    let predicted_value = predictions.get(0).cloned().unwrap_or(0.0);

    let resp = PredictionResponse {
        user_id: req.user_id.clone(),
        prediction_type: "burn_prediction".to_string(),
        probability: predicted_value as f64,
        confidence: 0.9, // Placeholder confidence
        factors: vec!["burn_model_features".to_string()],
        predicted_success_rate: predicted_value as f64,
        recommended_study_time: (50.0 - predicted_value as f64 * 10.0).round() as i64, // Example calculation
    };

    HttpResponse::Ok().json(resp)
}

async fn health_check_handler() -> impl Responder {
    HttpResponse::Ok().json(serde_json::json!({"status": "ok"}))
}

pub async fn run() -> std::io::Result<()> {
    dotenv().ok();

    let pool = init_pool().await.expect("Failed to create pool");

    // gRPC Server
    let grpc_pool = pool.clone();
    let grpc_host = env::var("RUST_ANALYTICS_GRPC_HOST").unwrap_or_else(|_| "[::1]".to_string());
    let grpc_port = env::var("RUST_ANALYTICS_GRPC_PORT").unwrap_or_else(|_| "50051".to_string());
    let grpc_addr = format!("{}:{}", grpc_host, grpc_port).parse().unwrap();
    let analytics_service = MyAnalyticsService::new(grpc_pool);

    tokio::spawn(async move {
        println!("gRPC server listening on {}", grpc_addr);
        Server::builder()
            .add_service(AnalyticsServiceServer::new(analytics_service))
            .serve(grpc_addr)
            .await
            .unwrap();
    });

    // Actix-web Server
    println!("Configuring HTTP server...");
    let http_host = env::var("RUST_ANALYTICS_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
    let http_port = env::var("RUST_ANALYTICS_PORT").unwrap_or_else(|_| "8000".to_string());
    let http_addr = format!("{}:{}", http_host, http_port);
    println!("HTTP server address: {}", http_addr);

    HttpServer::new(move || {
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
    .run()
    .await
}
