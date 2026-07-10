#[cfg(feature = "ml")]
pub mod performance_service;
pub mod recommendation_service;
#[cfg(feature = "ml")]
pub mod bkt_service;
#[cfg(feature = "ml")]
pub mod burn_model_service;

#[cfg(feature = "ml")]
pub use performance_service::get_performance_analytics;
pub use recommendation_service::get_recommendations_ai;
#[cfg(feature = "ml")]
pub use bkt_service::predict_bkt;

#[cfg(feature = "ml")]
pub use crate::domain::services::burn_model_service::predict_with_burn;

#[cfg(not(feature = "ml"))]
pub async fn predict_with_burn(_user_id: &str) -> Result<(), Box<dyn std::error::Error>> {
    Err("ML feature disabled".into())
}

// domain/services: re-export analytics submodule services where applicable
// Currently we only have recommendations' service in modules/analytics
pub use crate::modules::analytics::recommendations::service as recommendations_service;
