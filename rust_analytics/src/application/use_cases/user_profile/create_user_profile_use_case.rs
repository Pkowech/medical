/// Create User Profile Use Case
/// Handles the creation of a new user profile.

use crate::application::dtos::{CreateUserProfileRequest, UserProfileResponse};
use crate::domain::repositories::UserProfileRepository;
use crate::domain::models::UserProfile;
use crate::shared::error::AnalyticsError;
use std::sync::Arc;

#[derive(Clone)]
pub struct CreateUserProfileUseCase {
    user_profile_repository: Arc<dyn UserProfileRepository>,
}

impl CreateUserProfileUseCase {
    pub fn new(user_profile_repository: Arc<dyn UserProfileRepository>) -> Self {
        Self { user_profile_repository }
    }

    pub async fn execute(
        &self,
        request: CreateUserProfileRequest,
    ) -> Result<UserProfileResponse, AnalyticsError> {
        // Validate input
        if request.user_id.is_empty() {
            return Err(AnalyticsError::ValidationError(
                "user_id is required".to_string(),
            ));
        }

        let user_profile = UserProfile {
            user_id: request.user_id.clone(),
            learning_style: request.learning_style,
            preferred_language: request.preferred_language,
            timezone: request.timezone,
        };

        let created_profile = self
            .user_profile_repository
            .create_user_profile(user_profile)
            .await?;

        Ok(UserProfileResponse {
            user_id: created_profile.user_id,
            learning_style: created_profile.learning_style,
            preferred_language: created_profile.preferred_language,
            timezone: created_profile.timezone,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // use async_trait::async_trait;
    // use mockall::{automock, predicate::*};
    // use crate::domain::models::UserProfile;
    // use tokio;

    // #[automock]
    // #[async_trait]
    // impl UserProfileRepository for MockUserProfileRepository {
    //     async fn create_user_profile(
    //         &self,
    //         user_profile: UserProfile,
    //     ) -> Result<UserProfile, AnalyticsError> {
    //         self.create_user_profile(user_profile).await
    //     }
    //     async fn get_user_profile(&self, user_id: &str) -> Result<UserProfile, AnalyticsError> {
    //         self.get_user_profile(user_id).await
    //     }
    //     async fn update_user_profile(
    //         &self,
    //         user_profile: UserProfile,
    //     ) -> Result<UserProfile, AnalyticsError> {
    //         self.update_user_profile(user_profile).await
    //     }
    // }

    // #[tokio::test]
    // async fn test_create_user_profile_success() {
    //     let mut mock_repo = MockUserProfileRepository::new();
    //     mock_repo
    //         .expect_create_user_profile()
    //         .returning(|profile| Ok(profile));

    //     let use_case = CreateUserProfileUseCase::new(Arc::new(mock_repo));

    //     let request = CreateUserProfileRequest {
    //         user_id: "test_user_123".to_string(),
    //         learning_style: Some("visual".to_string()),
    //         preferred_language: Some("en".to_string()),
    //         timezone: Some("UTC".to_string()),
    //     };

    //     let response = use_case.execute(request.clone()).await.unwrap();

    //     assert_eq!(response.user_id, request.user_id);
    //     assert_eq!(response.learning_style, request.learning_style);
    //     assert_eq!(response.preferred_language, request.preferred_language);
    //     assert_eq!(response.timezone, request.timezone);
    // }

    // #[tokio::test]
    // async fn test_create_user_profile_missing_user_id() {
    //     let mock_repo = MockUserProfileRepository::new();
    //     let use_case = CreateUserProfileUseCase::new(Arc::new(mock_repo));

    //     let request = CreateUserProfileRequest {
    //         user_id: "".to_string(),
    //         learning_style: Some("visual".to_string()),
    //         preferred_language: Some("en".to_string()),
    //         timezone: Some("UTC".to_string()),
    //     };

    //     let error = use_case.execute(request).await.unwrap_err();
    //     assert!(matches!(error, AnalyticsError::ValidationError(_)));
    //     assert_eq!(error.to_string(), "Validation Error: user_id is required");
    // }
}
