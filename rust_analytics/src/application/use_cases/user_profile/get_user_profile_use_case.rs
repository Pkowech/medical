/// Get User Profile Use Case
/// Handles the retrieval of a user's profile.

use crate::application::dtos::{GetUserProfileRequest, UserProfileResponse};
use crate::domain::repositories::UserProfileRepository;
use crate::shared::error::AnalyticsError;
use std::sync::Arc;

#[derive(Clone)]
pub struct GetUserProfileUseCase {
    user_profile_repository: Arc<dyn UserProfileRepository>,
}

impl GetUserProfileUseCase {
    pub fn new(user_profile_repository: Arc<dyn UserProfileRepository>) -> Self {
        Self { user_profile_repository }
    }

    pub async fn execute(
        &self,
        request: GetUserProfileRequest,
    ) -> Result<UserProfileResponse, AnalyticsError> {
        // Validate input
        if request.user_id.is_empty() {
            return Err(AnalyticsError::ValidationError(
                "user_id is required".to_string(),
            ));
        }

        let user_profile = self
            .user_profile_repository
            .get_user_profile(&request.user_id)
            .await?;

        Ok(UserProfileResponse {
            user_id: user_profile.user_id,
            learning_style: user_profile.learning_style,
            preferred_language: user_profile.preferred_language,
            timezone: user_profile.timezone,
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
    // async fn test_get_user_profile_success() {
    //     let mut mock_repo = MockUserProfileRepository::new();
    //     let expected_profile = UserProfile {
    //         user_id: "test_user_456".to_string(),
    //         learning_style: Some("auditory".to_string()),
    //         preferred_language: Some("fr".to_string()),
    //         timezone: Some("Europe/Paris".to_string()),
    //     };
    //     mock_repo
    //         .expect_get_user_profile()
    //         .returning(move |_| Ok(expected_profile.clone()));

    //     let use_case = GetUserProfileUseCase::new(Arc::new(mock_repo));

    //     let request = GetUserProfileRequest {
    //         user_id: "test_user_456".to_string(),
    //     };

    //     let response = use_case.execute(request).await.unwrap();

    //     assert_eq!(response.user_id, "test_user_456");
    //     assert_eq!(response.learning_style, Some("auditory".to_string()));
    //     assert_eq!(response.preferred_language, Some("fr".to_string()));
    //     assert_eq!(response.timezone, Some("Europe/Paris".to_string()));
    // }

    // #[tokio::test]
    // async fn test_get_user_profile_not_found() {
    //     let mut mock_repo = MockUserProfileRepository::new();
    //     mock_repo
    //         .expect_get_user_profile()
    //         .returning(|_| Err(AnalyticsError::NotFound("Profile not found".to_string())));

    //     let use_case = GetUserProfileUseCase::new(Arc::new(mock_repo));

    //     let request = GetUserProfileRequest {
    //         user_id: "non_existent_user".to_string(),
    //     };

    //     let error = use_case.execute(request).await.unwrap_err();
    //     assert!(matches!(error, AnalyticsError::NotFound(_)));
    //     assert_eq!(error.to_string(), "Not Found: Profile not found");
    // }

    // #[tokio::test]
    // async fn test_get_user_profile_missing_user_id() {
    //     let mock_repo = MockUserProfileRepository::new();
    //     let use_case = GetUserProfileUseCase::new(Arc::new(mock_repo));

    //     let request = GetUserProfileRequest {
    //         user_id: "".to_string(),
    //     };

    //     let error = use_case.execute(request).await.unwrap_err();
    //     assert!(matches!(error, AnalyticsError::ValidationError(_)));
    //     assert_eq!(error.to_string(), "Validation Error: user_id is required");
    // }
}
