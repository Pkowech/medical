use sqlx::{Pool, Postgres};
use tonic::{Request, Response, Status};
use std::sync::Arc;
use crate::analytics_proto::{
    GetRecommendationsRequest, GetRecommendationsResponse, RecommendationItem,
    CollaborativeRecommendationRequest, CollaborativeRecommendationResponse, CollaborativeRecommendationItem,
    TrendingPathsRequest, TrendingPathsResponse, TrendingPath,
    GetFilteredRecommendationsRequest, GetFilteredRecommendationsResponse,
    RelatedResourcesRequest, RelatedResourcesResponse, RelatedResource,
};
use crate::infrastructure::database::repositories::PostgresRecommendationRepository;
use crate::application::use_cases::recommendations::{
    GetRecommendationsUseCase,
    GetRecommendationsRequest as AppGetRecommendationsRequest,
};

pub struct RecommendationService {
    pool: Pool<Postgres>,
}

impl RecommendationService {
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self { pool }
    }

    fn validate_user_id(user_id: &str) -> Result<(), Status> {
        if user_id.is_empty() {
            return Err(Status::invalid_argument("user_id cannot be empty"));
        }
        Ok(())
    }

    pub async fn get_recommendations(
        &self,
        request: Request<GetRecommendationsRequest>,
    ) -> Result<Response<GetRecommendationsResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id;

        Self::validate_user_id(&user_id)?;

        let repo = PostgresRecommendationRepository::new(Arc::new(self.pool.clone()));
        let use_case = GetRecommendationsUseCase::new(Arc::new(repo));

        let app_req = AppGetRecommendationsRequest { user_id: user_id.clone(), limit: None };
        let result = use_case
            .execute(app_req)
            .await
            .map_err(|e| Status::internal(format!("Recommendations failed: {}", e)))?;

        let items = result
            .recommendations
            .into_iter()
            .map(|r| RecommendationItem {
                id: r.material_id,
                title: r.title,
                description: r.description,
                r#type: "recommendation".to_string(),
                score: r.score,
                reason: String::new(),
            })
            .collect();

        Ok(Response::new(GetRecommendationsResponse { items }))
    }

    pub async fn get_collaborative_recommendations(
        &self,
        request: Request<CollaborativeRecommendationRequest>,
    ) -> Result<Response<CollaborativeRecommendationResponse>, Status> {
        let req = request.into_inner();
        let limit = if req.limit <= 0 { 5 } else { req.limit };

        match crate::modules::analytics::recommendations::collaborative::get_collaborative_recommendations(&req.user_id, limit, &self.pool).await {
            Ok(items) => {
                let proto_items = items
                    .into_iter()
                    .map(|it| CollaborativeRecommendationItem { 
                        item_id: it.item_id, 
                        score: it.score, 
                        reason: it.reason.unwrap_or_default() 
                    })
                    .collect();
                Ok(Response::new(CollaborativeRecommendationResponse { items: proto_items }))
            }
            Err(e) => Err(Status::internal(format!("collab recs failed: {}", e))),
        }
    }

    pub async fn get_trending_paths(
        &self, 
        request: Request<TrendingPathsRequest>
    ) -> Result<Response<TrendingPathsResponse>, Status> {
        let req = request.into_inner();
        let limit = req.limit;
        
        match crate::modules::analytics::system::trending_paths::get_trending_paths(limit, &self.pool).await {
            Ok(paths) => {
                let proto_paths = paths
                    .into_iter()
                    .map(|p| TrendingPath { 
                        path_id: p.path_id, 
                        popularity: p.popularity 
                    })
                    .collect();
                Ok(Response::new(TrendingPathsResponse { paths: proto_paths }))
            }
            Err(e) => Err(Status::internal(format!("trending paths failed: {}", e))),
        }
    }

    pub async fn get_filtered_recommendations(
        &self,
        request: Request<GetFilteredRecommendationsRequest>,
    ) -> Result<Response<GetFilteredRecommendationsResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id;

        Self::validate_user_id(&user_id)?;

        // Return empty recommendations for now - can be enhanced later
        let response = GetFilteredRecommendationsResponse {
            items: vec![],
        };

        Ok(Response::new(response))
    }

    pub async fn get_related_resources(
        &self, 
        request: Request<RelatedResourcesRequest>
    ) -> Result<Response<RelatedResourcesResponse>, Status> {
        let r = request.into_inner();
        
        match crate::modules::analytics::system::related_resources::get_related_resources(&r.resource_id, &self.pool).await {
            Ok(resources) => {
                let proto_res = resources
                    .into_iter()
                    .map(|r| RelatedResource { 
                        id: r.resource_id, 
                        title: r.title, 
                        r#type: r.resource_type, 
                        score: 0.0_f64,
                    })
                    .collect();
                Ok(Response::new(RelatedResourcesResponse { resources: proto_res }))
            }
            Err(e) => Err(Status::internal(format!("related resources failed: {}", e))),
        }
    }

    pub async fn generate_study_recommendations(
        &self, 
        request: Request<crate::analytics_proto::StudyRecommendationsRequest>
    ) -> Result<Response<crate::analytics_proto::StudyRecommendationsResponse>, Status> {
        let r = request.into_inner();
        
        match crate::modules::analytics::recommendations::study_recommendations::generate_study_recommendations(&r.user_id, &r.knowledge_gaps, &self.pool).await {
            Ok(items) => {
                let proto_items = items
                    .into_iter()
                    .map(|it| crate::analytics_proto::StudyRecommendationItem { 
                        recommendation: it.recommendation, 
                        priority: it.priority.unwrap_or_default(), 
                        estimated_time_hours: it.estimated_time_hours.unwrap_or_default(), 
                        resource_id: it.resource_id.unwrap_or_default() 
                    })
                    .collect();
                Ok(Response::new(crate::analytics_proto::StudyRecommendationsResponse { recommendations: proto_items }))
            }
            Err(e) => Err(Status::internal(format!("study recs failed: {}", e))),
        }
    }

    pub async fn generate_next_steps(
        &self, 
        request: Request<crate::analytics_proto::NextStepsRequest>
    ) -> Result<Response<crate::analytics_proto::NextStepsResponse>, Status> {
        let r = request.into_inner();
        
        match crate::modules::analytics::recommendations::next_steps::generate_next_steps(&r.user_id, &self.pool).await {
            Ok(steps) => {
                let proto_steps = steps
                    .into_iter()
                    .map(|s| crate::analytics_proto::NextStepItem { 
                        step: s.step, 
                        reason: s.reason.unwrap_or_default(), 
                        estimated_duration_minutes: s.estimated_duration_minutes.unwrap_or_default() 
                    })
                    .collect();
                Ok(Response::new(crate::analytics_proto::NextStepsResponse { steps: proto_steps }))
            }
            Err(e) => Err(Status::internal(format!("next steps failed: {}", e))),
        }
    }
}
