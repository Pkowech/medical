/// Application layer use cases
/// Clean Architecture implementation of user-facing workflows
///
/// Each use case encapsulates a single business operation:
/// - Input validation
/// - Domain service orchestration
/// - Repository coordination
/// - Error handling
///
/// Use cases are completely independent of:
/// - gRPC, REST, or any web framework
/// - Database implementation details
/// - External service specifics

#[cfg(feature = "ml")]
pub mod performance;
pub mod goals;
// pub mod user_profile;  // TODO: Disabled due to missing domain::models infrastructure
#[cfg(feature = "ml")]
pub mod recommendations;
#[cfg(feature = "ml")]
pub mod engagement;
pub mod course_progress;
pub mod path_analytics;

// Re-export commonly used types
#[cfg(feature = "ml")]
pub use performance::{
    PredictPerformanceUseCase,
    UpdateBktUseCase,
};
pub use goals::{
    GetGoalsUseCase,
    UpdateGoalUseCase,
};
// pub use user_profile::{
//     CreateUserProfileUseCase,
//     GetUserProfileUseCase,
//     UpdateUserProfileUseCase,
// };
#[cfg(feature = "ml")]
pub use recommendations::{
    GetRecommendationsUseCase,
    GetRecommendationsRequest as AppGetRecommendationsRequest,
    GetRecommendationsResponse as AppGetRecommendationsResponse,
};
#[cfg(feature = "ml")]
pub use engagement::{
    GetEngagementMetricsUseCase,
};
pub use course_progress::{
    GetCourseProgressUseCase,
};
pub use path_analytics::{
    GetPathAnalyticsUseCase,
};
