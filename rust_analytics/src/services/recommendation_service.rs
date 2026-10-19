use sqlx::{Pool, Postgres, Row};
use tonic::{Request, Response, Status};
use std::sync::Arc;
use crate::analytics_proto::{
    GetRecommendationsRequest, GetRecommendationsResponse, RecommendationItem,
    UnifiedRecommendationsRequest, UnifiedRecommendationsResponse, UnifiedRecommendationItem,
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
        if user_id.trim().is_empty() {
            return Err(Status::invalid_argument("user_id cannot be empty"));
        }
        Ok(())
    }

    fn effective_limit(requested: i32) -> usize {
        if requested <= 0 {
            10
        } else {
            requested.min(100) as usize
        }
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
        let app_req = AppGetRecommendationsRequest {
            user_id: user_id.clone(),
            limit: if req.limit > 0 {
                Some(req.limit)
            } else {
                None
            },
        };
        let result = use_case
            .execute(app_req)
            .await
            .map_err(|e| Status::internal(format!("Recommendations failed: {}", e)))?;

        let items = result
            .recommendations
            .into_iter()
            .map(|r| RecommendationItem {
                id: r.path_id,
                title: r.title,
                description: r.description,
                r#type: "learning_path".to_string(),
                score: r.score,
                reason: r.reason,
            })
            .collect();

        Ok(Response::new(GetRecommendationsResponse { items }))
    }

    pub async fn get_unified_recommendations(
        &self,
        request: Request<UnifiedRecommendationsRequest>,
    ) -> Result<Response<UnifiedRecommendationsResponse>, Status> {
        let req = request.into_inner();
        Self::validate_user_id(&req.user_id)?;

        let limit = Self::effective_limit(req.limit);
        let candidate_limit = limit
            .saturating_add(req.exclude_ids.len())
            .min(100) as i32;

        let mut items = match req.context.as_str() {
            "learning_path" => {
                let repo =
                    PostgresRecommendationRepository::new(Arc::new(self.pool.clone()));
                let use_case = GetRecommendationsUseCase::new(Arc::new(repo));
                let result = use_case
                    .execute(AppGetRecommendationsRequest {
                        user_id: req.user_id.clone(),
                        limit: Some(candidate_limit),
                    })
                    .await
                    .map_err(|error| {
                        Status::internal(format!("Recommendations failed: {error}"))
                    })?;

                result
                    .recommendations
                    .into_iter()
                    .map(|recommendation| UnifiedRecommendationItem {
                        id: recommendation.path_id,
                        title: recommendation.title,
                        description: recommendation.description,
                        r#type: "learning_path".to_string(),
                        score: Some(recommendation.score),
                        reason: recommendation.reason,
                        priority: String::new(),
                        estimated_duration_minutes: 0,
                        resource_id: None,
                    })
                    .collect()
            }
            "collaborative" => {
                let recommendations =
                    crate::modules::analytics::recommendations::collaborative::
                        get_collaborative_recommendations(
                            &req.user_id,
                            candidate_limit,
                            &self.pool,
                        )
                        .await
                        .map_err(|error| {
                            Status::internal(format!(
                                "Collaborative recommendations failed: {error}"
                            ))
                        })?;

                recommendations
                    .into_iter()
                    .map(|recommendation| UnifiedRecommendationItem {
                        id: recommendation.item_id.clone(),
                        title: recommendation.item_id,
                        description: String::new(),
                        r#type: "learning_path".to_string(),
                        score: Some(recommendation.score as f32),
                        reason: recommendation.reason,
                        priority: String::new(),
                        estimated_duration_minutes: 0,
                        resource_id: None,
                    })
                    .collect()
            }
            "study_material" => {
                let recommendations =
                    crate::modules::analytics::recommendations::study_recommendations::
                        generate_study_recommendations(
                            &req.user_id,
                            &req.knowledge_gaps,
                            &self.pool,
                        )
                        .await
                        .map_err(|error| {
                            Status::internal(format!(
                                "Study recommendations failed: {error}"
                            ))
                        })?;

                recommendations
                    .into_iter()
                    .enumerate()
                    .map(|(index, recommendation)| {
                        let resource_id = recommendation.resource_id;
                        UnifiedRecommendationItem {
                            id: resource_id
                                .clone()
                                .unwrap_or_else(|| format!("knowledge-gap-{index}")),
                            title: recommendation.recommendation,
                            description: String::new(),
                            r#type: "study_material".to_string(),
                            score: Some(match recommendation.priority.as_str() {
                                "high" => 0.9,
                                "medium" => 0.6,
                                _ => 0.3,
                            }),
                            reason: format!(
                                "Prioritized to address a {}-priority knowledge gap",
                                recommendation.priority
                            ),
                            priority: recommendation.priority,
                            estimated_duration_minutes: recommendation
                                .estimated_time_hours
                                .saturating_mul(60),
                            resource_id,
                        }
                    })
                    .collect()
            }
            "next_step" => {
                let steps = crate::modules::analytics::recommendations::next_steps::
                    generate_next_steps(&req.user_id, &self.pool)
                        .await
                        .map_err(|error| {
                            Status::internal(format!("Next steps failed: {error}"))
                        })?;

                steps
                    .into_iter()
                    .enumerate()
                    .map(|(index, step)| UnifiedRecommendationItem {
                        id: format!("next-step-{index}"),
                        title: step.step,
                        description: String::new(),
                        r#type: "next_step".to_string(),
                        score: None,
                        reason: step.reason.unwrap_or_default(),
                        priority: String::new(),
                        estimated_duration_minutes: step
                            .estimated_duration_minutes
                            .unwrap_or_default(),
                        resource_id: None,
                    })
                    .collect()
            }
            "assessment" => {
                let recommendations = sqlx::query(
                    r#"
                    SELECT
                        q.id,
                        q.title,
                        COALESCE(q.description, '') AS description,
                        GREATEST(
                            0.0,
                            LEAST(
                                1.0,
                                1.0 - COALESCE(
                                    uss.p_known::double precision,
                                    AVG(qa.percentage)::double precision / 100.0,
                                    0.5
                                )
                            )
                        ) AS score
                    FROM quizzes q
                    LEFT JOIN quiz_attempts qa
                        ON qa.quiz_id = q.id AND qa.user_id = $1
                    LEFT JOIN user_skill_states uss
                        ON uss.user_id = $1 AND uss.skill_id = q.topic_id
                    WHERE q.is_published = TRUE
                        AND (q.available_from IS NULL OR q.available_from <= NOW())
                        AND (q.available_until IS NULL OR q.available_until >= NOW())
                        AND NOT EXISTS (
                            SELECT 1
                            FROM quiz_attempts passed
                            WHERE passed.user_id = $1
                                AND passed.quiz_id = q.id
                                AND passed.is_passed = TRUE
                        )
                    GROUP BY q.id, uss.p_known
                    ORDER BY COALESCE(
                        uss.p_known::double precision,
                        AVG(qa.percentage)::double precision / 100.0,
                        0.5
                    ) ASC, q.title ASC
                    LIMIT $2
                    "#,
                )
                .bind(&req.user_id)
                .bind(candidate_limit)
                .fetch_all(&self.pool)
                .await
                .map_err(|error| {
                    Status::internal(format!("Assessment recommendations failed: {error}"))
                })?;

                recommendations
                    .into_iter()
                    .map(|row| {
                        Ok(UnifiedRecommendationItem {
                            id: row.try_get("id").map_err(|error| {
                                Status::internal(format!(
                                    "Failed to read assessment recommendation id: {error}"
                                ))
                            })?,
                            title: row.try_get("title").map_err(|error| {
                                Status::internal(format!(
                                    "Failed to read assessment recommendation title: {error}"
                                ))
                            })?,
                            description: row.try_get("description").map_err(|error| {
                                Status::internal(format!(
                                    "Failed to read assessment recommendation description: {error}"
                                ))
                            })?,
                            r#type: "assessment".to_string(),
                            score: Some(
                                row.try_get::<f64, _>("score").map_err(|error| {
                                    Status::internal(format!(
                                        "Failed to read assessment recommendation score: {error}"
                                    ))
                                })? as f32,
                            ),
                            reason: "Recommended based on your learning progress".to_string(),
                            priority: String::new(),
                            estimated_duration_minutes: 0,
                            resource_id: None,
                        })
                    })
                    .collect::<Result<Vec<_>, Status>>()?
            }
            _ => {
                return Err(Status::invalid_argument(
                    "context must be one of: learning_path, collaborative, study_material, next_step, assessment",
                ));
            }
        };

        items.retain(|item| !req.exclude_ids.contains(&item.id));
        items.truncate(limit);

        Ok(Response::new(UnifiedRecommendationsResponse { items }))
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
                        reason: it.reason 
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
                        priority: it.priority, 
                        estimated_time_hours: it.estimated_time_hours, 
                        resource_id: it.resource_id,
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

#[cfg(test)]
mod tests {
    use super::RecommendationService;

    #[test]
    fn recommendation_limit_defaults_and_is_bounded() {
        assert_eq!(RecommendationService::effective_limit(0), 10);
        assert_eq!(RecommendationService::effective_limit(-1), 10);
        assert_eq!(RecommendationService::effective_limit(7), 7);
        assert_eq!(RecommendationService::effective_limit(1000), 100);
    }
}
