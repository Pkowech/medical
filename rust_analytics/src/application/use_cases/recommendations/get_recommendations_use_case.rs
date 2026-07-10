/// Get Recommendations Use Case
/// Retrieves learning material recommendations for a user.

use crate::domain::repositories::RecommendationRepository;
use crate::modules::analytics::recommendations::service::Recommendation as ModuleRecommendation;
use crate::shared::error::AnalyticsError;
use std::sync::Arc;

/// Request for recommendations
#[derive(Debug, Clone)]
pub struct GetRecommendationsRequest {
    pub user_id: String,
    pub limit: Option<i32>,
}

/// Single recommendation item returned to caller
#[derive(Debug, Clone)]
pub struct RecommendationItem {
    pub material_id: String,
    pub score: f32,
    pub title: String,
    pub description: String,
}

/// Response for recommendations
#[derive(Debug, Clone)]
pub struct GetRecommendationsResponse {
    pub user_id: String,
    pub recommendations: Vec<RecommendationItem>,
}

#[derive(Clone)]
pub struct GetRecommendationsUseCase {
    recommendation_repository: Arc<dyn RecommendationRepository>,
}

impl GetRecommendationsUseCase {
    pub fn new(recommendation_repository: Arc<dyn RecommendationRepository>) -> Self {
        Self { recommendation_repository }
    }

    pub async fn execute(
        &self,
        request: GetRecommendationsRequest,
    ) -> Result<GetRecommendationsResponse, AnalyticsError> {
        // Validate input
        if request.user_id.is_empty() {
            return Err(AnalyticsError::ValidationError(
                "user_id is required".to_string(),
            ));
        }

        let limit = request.limit.unwrap_or(10) as usize;

        let recommendations: Vec<ModuleRecommendation> = self
            .recommendation_repository
            .get_recommendations(&request.user_id, limit)
            .await?;

        let proto_recs = recommendations
            .into_iter()
            .map(|rec| RecommendationItem {
                material_id: rec.material_id,
                score: rec.score as f32,
                title: rec.reason.clone(),
                description: String::new(),
            })
            .collect();

        Ok(GetRecommendationsResponse {
            user_id: request.user_id,
            recommendations: proto_recs,
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // use async_trait::async_trait;
    // use mockall::{automock, predicate::*};
    // use crate::domain::models::Recommendation;
    // use tokio;

    // #[automock]
    // #[async_trait]
    // impl RecommendationRepository for MockRecommendationRepository {
    //     async fn get_recommendations(&self, user_id: &str, limit: usize) -> Result<Vec<Recommendation>, AnalyticsError> {
    //         self.get_recommendations(user_id, limit).await
    //     }
    //     async fn store_recommendation_score(&self, user_id: &str, material_id: &str, score: f64) -> Result<(), AnalyticsError> {
    //         self.store_recommendation_score(user_id, material_id, score).await
    //     }
    //     async fn get_user_preferences(&self, user_id: &str) -> Result<serde_json::Value, AnalyticsError> {
    //         self.get_user_preferences(user_id).await
    //     }
    // }

    // #[tokio::test]
    // async fn test_get_recommendations_success() {
    //     let mut mock_repo = MockRecommendationRepository::new();
    //     let expected_recs = vec![
    //         Recommendation {
    //             material_id: "mat1".to_string(),
    //             score: 0.9,
    //             title: Some("Title 1".to_string()),
    //             description: Some("Desc 1".to_string()),
    //         },
    //         Recommendation {
    //             material_id: "mat2".to_string(),
    //             score: 0.8,
    //             title: Some("Title 2".to_string()),
    //             description: Some("Desc 2".to_string()),
    //         },
    //     ];
    //     mock_repo
    //         .expect_get_recommendations()
    //         .returning(move |_, _| Ok(expected_recs.clone()));

    //     let use_case = GetRecommendationsUseCase::new(Arc::new(mock_repo));

    //     let request = GetRecommendationsRequest {
    //         user_id: "user123".to_string(),
    //         limit: Some(2),
    //     };

    //     let response = use_case.execute(request).await.unwrap();

    //     assert_eq!(response.user_id, "user123");
    //     assert_eq!(response.recommendations.len(), 2);
    //     assert_eq!(response.recommendations[0].material_id, "mat1");
    //     assert_eq!(response.recommendations[0].score, 0.9 as f32);
    // }

    // #[tokio::test]
    // async fn test_get_recommendations_empty_user_id() {
    //     let mock_repo = MockRecommendationRepository::new();
    //     let use_case = GetRecommendationsUseCase::new(Arc::new(mock_repo));

    //     let request = GetRecommendationsRequest {
    //         user_id: "".to_string(),
    //         limit: Some(5),
    //     };

    //     let error = use_case.execute(request).await.unwrap_err();
    //     assert!(matches!(error, AnalyticsError::ValidationError(_)));
    //     assert_eq!(error.to_string(), "Validation Error: user_id is required");
    // }
}
