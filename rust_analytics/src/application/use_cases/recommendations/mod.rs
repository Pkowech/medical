/// Recommendations-related use cases
/// Manages learning material recommendations

pub mod get_recommendations_use_case;

// Re-export use cases
pub use get_recommendations_use_case::{
    GetRecommendationsUseCase,
    GetRecommendationsRequest,
    GetRecommendationsResponse,
};
