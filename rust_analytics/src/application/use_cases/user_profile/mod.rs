/// User Profile-related use cases
/// Manages user profile creation, retrieval, and updates

pub mod create_user_profile_use_case;
pub mod get_user_profile_use_case;
pub mod update_user_profile_use_case;

// Re-export use cases
pub use create_user_profile_use_case::CreateUserProfileUseCase;
pub use get_user_profile_use_case::GetUserProfileUseCase;
pub use update_user_profile_use_case::UpdateUserProfileUseCase;
