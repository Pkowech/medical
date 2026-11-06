//! Application layer use cases following Clean Architecture.
//!
//! Each use case encapsulates one business operation:
//! - Input validation
//! - Domain service orchestration
//! - Repository coordination
//! - Error handling
//!
//! Use cases are independent of gRPC, REST, web frameworks, database
//! implementation details, and external services.

pub mod goals;
#[cfg(feature = "ml")]
pub mod performance;
// pub mod user_profile;  // TODO: Disabled due to missing domain::models infrastructure
pub mod course_progress;
#[cfg(feature = "ml")]
pub mod engagement;
pub mod path_analytics;
#[cfg(feature = "ml")]
pub mod recommendations;

// Re-export commonly used types
pub use goals::{GetGoalsUseCase, UpdateGoalUseCase};
#[cfg(feature = "ml")]
pub use performance::{PredictPerformanceUseCase, UpdateBktUseCase};
// pub use user_profile::{
//     CreateUserProfileUseCase,
//     GetUserProfileUseCase,
//     UpdateUserProfileUseCase,
// };
pub use course_progress::GetCourseProgressUseCase;
#[cfg(feature = "ml")]
pub use engagement::GetEngagementMetricsUseCase;
pub use path_analytics::GetPathAnalyticsUseCase;
#[cfg(feature = "ml")]
pub use recommendations::{
    GetRecommendationsRequest as AppGetRecommendationsRequest,
    GetRecommendationsResponse as AppGetRecommendationsResponse, GetRecommendationsUseCase,
};
