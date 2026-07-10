#[cfg(feature = "ml")]
mod inner {

    use crate::analytics_proto::{
        analytics_service_server::AnalyticsService, AttemptMetricsRequest, BatchEventRequest,
        BatchEventResponse, CalculateCourseProgressRequest, CohortAnalyticsResponse,
        CollaborativeRecommendationRequest, CollaborativeRecommendationResponse, CourseProgress,
        CourseStatsResultResponse, DueCard, FocusArea, GetCohortAnalyticsRequest,
        GetCourseStatisticsRequest, GetDetailedLearningAnalyticsRequest,
        GetDetailedLearningAnalyticsResponse, GetDueCardsRequest, GetDueCardsResponse,
        GetEngagementMetricsRequest, GetEngagementMetricsResponse, GetFocusRecommendationsRequest,
        GetFocusRecommendationsResponse, GetGoalAnalyticsRequest, GetLearningPathStatisticsRequest,
        GetNextAdaptiveQuestionRequest, GetNextAdaptiveQuestionResponse, GetRecommendationsRequest,
        GetRecommendationsResponse, GetSpacedRepetitionStatsRequest,
        GetSpacedRepetitionStatsResponse, GetUserAbilityRequest, GetUserAbilityResponse,
        GetUserDataForProfileRequest, GetUserDataForProfileResponse, GetUserFeatureVectorRequest,
        GetUserFeatureVectorResponse, GetUserLearningSummaryRequest, HealthRequest, HealthResponse,
        LearningGoalAnalyticsResponse, LearningPathStatsResultResponse, NextStepsRequest,
        NextStepsResponse, PathAnalyticsRequest, PathAnalyticsResponse, PredictBktRequest,
        PredictBktResponse, PredictBurnRequest, PredictBurnResponse, PredictPerformanceRequest,
        PredictPerformanceResponse, QuizAttemptHistoryRequest, QuizAttemptHistoryResponse,
        RelatedResourcesRequest, RelatedResourcesResponse, SpacedRepetitionStatsProto,
        StudyRecommendationsRequest, StudyRecommendationsResponse, TrendingPathsRequest,
        TrendingPathsResponse, UpdateAttemptMetricsResponse, UpdateBktRequest, UpdateBktResponse,
        UserLearningSummaryResponse, GetFocusCorrelationRequest, GetFocusCorrelationResponse,
    };

    use crate::modules::analytics::performance::bkt;
    use crate::modules::analytics::performance::bkt::BKTParams;
    // Needed for update_attempt_metrics which is still inline?
    // Yes, update_attempt_metrics was left inline but without helpers.
    // It uses bkt::update_p_known and BKTParams. So keep these.
    use crate::modules::analytics::spaced_repetition::analytics::SpacedRepetitionAnalytics;

    use sqlx::{Pool, Postgres};
    use tonic::{Request, Response, Status};

    use crate::services::adaptive_service::AdaptiveService;
    use crate::services::engagement_service::EngagementService;
    use crate::services::learning_service::LearningService;
    use crate::services::performance_service::PerformanceService;
    use crate::services::recommendation_service::RecommendationService;

    pub struct MyAnalyticsService {
        pool: Pool<Postgres>,
    }

    #[cfg(feature = "ml")]
    impl MyAnalyticsService {
        pub fn new(pool: Pool<Postgres>) -> Self {
            Self { pool }
        }
    }

    #[cfg(feature = "ml")]
    #[tonic::async_trait]
    impl AnalyticsService for MyAnalyticsService {
        async fn get_health(
            &self,
            _request: Request<HealthRequest>,
        ) -> Result<Response<HealthResponse>, Status> {
            Ok(Response::new(HealthResponse {
                status: "ok".to_string(),
                timestamp: chrono::Utc::now().to_rfc3339(),
            }))
        }

        async fn predict_performance(
            &self,
            request: Request<PredictPerformanceRequest>,
        ) -> Result<Response<PredictPerformanceResponse>, Status> {
            let service = PerformanceService::new(self.pool.clone());
            service.predict_performance(request).await
        }

        async fn get_engagement_metrics(
            &self,
            request: Request<GetEngagementMetricsRequest>,
        ) -> Result<Response<GetEngagementMetricsResponse>, Status> {
            let service = EngagementService::new(self.pool.clone());
            service.get_engagement_metrics(request).await
        }

        async fn get_recommendations(
            &self,
            request: Request<GetRecommendationsRequest>,
        ) -> Result<Response<GetRecommendationsResponse>, Status> {
            let service = RecommendationService::new(self.pool.clone());
            service.get_recommendations(request).await
        }

        async fn update_attempt_metrics(
            &self,
            request: Request<AttemptMetricsRequest>,
        ) -> Result<Response<UpdateAttemptMetricsResponse>, Status> {
            let req = request.into_inner();
            let user_id = req.user_id;
            let attempt_id = req.attempt_id;
            let is_correct = req.correct;
            let skill_id = req.skill_id;
            let score = req.score;

            if user_id.is_empty() {
                return Err(Status::invalid_argument("user_id cannot be empty"));
            }

            // Start transaction
            let mut tx = self
                .pool
                .begin()
                .await
                .map_err(|e| Status::internal(format!("Failed to begin transaction: {}", e)))?;

            // Update quiz_attempts table
            if !attempt_id.is_empty() {
                // Schema uses `correct_answers` and `total_questions` (integers) and `percentage` (float).
                // Increment correct_answers when this response is correct, increment total_questions, and
                // update percentage accordingly in a single statement to keep counts consistent.
                sqlx::query(
                "UPDATE quiz_attempts SET score = $1,
                    correct_answers = COALESCE(correct_answers, 0) + (CASE WHEN $2 THEN 1 ELSE 0 END),
                    total_questions = COALESCE(total_questions, 0) + 1,
                    percentage = ((COALESCE(correct_answers, 0) + (CASE WHEN $2 THEN 1 ELSE 0 END))::float / (COALESCE(total_questions, 0) + 1)::float) * 100,
                    completed_at = NOW()
                 WHERE id = $3 AND user_id = $4"
            )
            .bind(score)
            .bind(is_correct)
            .bind(&attempt_id)
            .bind(&user_id)
            .execute(&mut *tx)
            .await
            .map_err(|e| Status::internal(format!("Failed to update attempt: {}", e)))?;
            }

            // Update BKT p_known for the skill
            if !skill_id.is_empty() {
                let current_p_known: Option<f64> = sqlx::query_scalar(
                    "SELECT p_known FROM user_skill_states WHERE user_id = $1 AND skill_id = $2",
                )
                .bind(&user_id)
                .bind(&skill_id)
                .fetch_optional(&mut *tx)
                .await
                .map_err(|e| Status::internal(format!("Database query failed: {}", e)))?;

                let p_known_prev = current_p_known.unwrap_or(BKTParams::default().p_init);
                let params = BKTParams::default();
                let p_known_new = bkt::update_p_known(p_known_prev, is_correct, &params);

                // Try update first to avoid FK violation on insert when `skill_id` (topic) doesn't exist.
                let update_res = sqlx::query(
                    "UPDATE user_skill_states SET p_known = $3, last_updated = NOW(), attempts = user_skill_states.attempts + 1 WHERE user_id = $1 AND skill_id = $2"
                )
                .bind(&user_id)
                .bind(&skill_id)
                .bind(p_known_new)
                .execute(&mut *tx)
                .await
                .map_err(|e| Status::internal(format!("Failed to update skill state: {}", e)))?;

                if update_res.rows_affected() == 0 {
                    // Only insert if the referenced skill/topic exists to respect FK constraint.
                    let topic_exists: Option<String> =
                        sqlx::query_scalar("SELECT id FROM topics WHERE id = $1")
                            .bind(&skill_id)
                            .fetch_optional(&mut *tx)
                            .await
                            .map_err(|e| {
                                Status::internal(format!("Database query failed: {}", e))
                            })?;

                    if topic_exists.is_some() {
                        sqlx::query(
                            "INSERT INTO user_skill_states (user_id, skill_id, p_known, last_updated, attempts) VALUES ($1, $2, $3, NOW(), 1)"
                        )
                        .bind(&user_id)
                        .bind(&skill_id)
                        .bind(p_known_new)
                        .execute(&mut *tx)
                        .await
                        .map_err(|e| Status::internal(format!("Failed to insert skill state: {}", e)))?;
                    } else {
                        // Skill doesn't exist in topics table; skip creating state to avoid FK violation.
                    }
                }
            }

            // Commit transaction
            tx.commit()
                .await
                .map_err(|e| Status::internal(format!("Failed to commit transaction: {}", e)))?;

            Ok(Response::new(UpdateAttemptMetricsResponse {
                success: true,
                message: "Attempt metrics updated successfully".to_string(),
            }))
        }

        async fn get_user_ability(
            &self,
            request: Request<GetUserAbilityRequest>,
        ) -> Result<Response<GetUserAbilityResponse>, Status> {
            let service = AdaptiveService::new(self.pool.clone());
            service.get_user_ability(request).await
        }

        async fn get_next_adaptive_question(
            &self,
            request: Request<GetNextAdaptiveQuestionRequest>,
        ) -> Result<Response<GetNextAdaptiveQuestionResponse>, Status> {
            let service = AdaptiveService::new(self.pool.clone());
            service.get_next_adaptive_question(request).await
        }

        async fn update_bkt(
            &self,
            request: Request<UpdateBktRequest>,
        ) -> Result<Response<UpdateBktResponse>, Status> {
            let service = PerformanceService::new(self.pool.clone());
            service.update_bkt(request).await
        }

        async fn get_user_learning_summary(
            &self,
            request: Request<GetUserLearningSummaryRequest>,
        ) -> Result<Response<UserLearningSummaryResponse>, Status> {
            let service = LearningService::new(self.pool.clone());
            service.get_user_learning_summary(request).await
        }

        async fn get_goal_analytics(
            &self,
            request: Request<GetGoalAnalyticsRequest>,
        ) -> Result<Response<LearningGoalAnalyticsResponse>, Status> {
            let service = LearningService::new(self.pool.clone());
            service.get_goal_analytics(request).await
        }

        async fn get_course_statistics(
            &self,
            request: Request<GetCourseStatisticsRequest>,
        ) -> Result<Response<CourseStatsResultResponse>, Status> {
            let service = LearningService::new(self.pool.clone());
            service.get_course_statistics(request).await
        }

        async fn get_learning_path_statistics(
            &self,
            request: Request<GetLearningPathStatisticsRequest>,
        ) -> Result<Response<LearningPathStatsResultResponse>, Status> {
            let service = LearningService::new(self.pool.clone());
            service.get_learning_path_statistics(request).await
        }

        async fn get_detailed_learning_analytics(
            &self,
            request: Request<GetDetailedLearningAnalyticsRequest>,
        ) -> Result<Response<GetDetailedLearningAnalyticsResponse>, Status> {
            let service = LearningService::new(self.pool.clone());
            service.get_detailed_learning_analytics(request).await
        }

        async fn calculate_course_progress(
            &self,
            request: Request<CalculateCourseProgressRequest>,
        ) -> Result<Response<CourseProgress>, Status> {
            let service = LearningService::new(self.pool.clone());
            service.calculate_course_progress(request).await
        }

        async fn get_user_data_for_profile(
            &self,
            request: Request<GetUserDataForProfileRequest>,
        ) -> Result<Response<GetUserDataForProfileResponse>, Status> {
            let service = LearningService::new(self.pool.clone());
            service.get_user_data_for_profile(request).await
        }

        async fn get_user_feature_vector(
            &self,
            request: Request<GetUserFeatureVectorRequest>,
        ) -> Result<Response<GetUserFeatureVectorResponse>, Status> {
            let service = LearningService::new(self.pool.clone());
            service.get_user_feature_vector(request).await
        }

        async fn get_filtered_recommendations(
            &self,
            request: Request<crate::analytics_proto::GetFilteredRecommendationsRequest>,
        ) -> Result<Response<crate::analytics_proto::GetFilteredRecommendationsResponse>, Status>
        {
            let service = RecommendationService::new(self.pool.clone());
            service.get_filtered_recommendations(request).await
        }

        async fn update_bkt_skill_metrics(
            &self,
            request: Request<crate::analytics_proto::UpdateBktSkillMetricsRequest>,
        ) -> Result<Response<crate::analytics_proto::UpdateBktSkillMetricsResponse>, Status>
        {
            let _req = request.into_inner();
            // Note: The protobuf message type here is Request<UpdateBktSkillMetricsRequest> which is a struct with no fields?
            // Or if it's empty, we should check. The service method takes Request<()>.
            // Wait, the proto definition likely has an empty message or no message?
            // In the original code (lines 694), it took `_request: Request<crate::analytics_proto::UpdateBktSkillMetricsRequest>`.
            // My PerformanceService implementations takes `request: Request<()>`.
            // I should check what UpdateBktSkillMetricsRequest is. If it's empty, I can pass `Request::new(())`.
            // If it's a dedicated type, I should update PerformanceService to take it, or map it.
            // Let's assume for now I can map it or pass () if appropriate.
            // Actually, looking at imports, UpdateBktSkillMetricsRequest is imported.
            // If PerformanceService takes Request<()>, I need to adjust.
            // I will change PerformanceService to take Request<UpdateBktSkillMetricsRequest> later if needed, but easier to map here.
            // Or just `let _ = request` and call `service.update_bkt_skill_metrics(Request::new(()))`?
            // Let's verify PerformanceService signature.
            // I wrote: `pub async fn update_bkt_skill_metrics(&self, request: Request<()>)`.
            // I should update PerformanceService to match the proto generated trait if I want direct delegation, OR map it here.
            // Direct delegation is cleaner. But `AnalyticsService` trait generated by tonic expects `UpdateBktSkillMetricsRequest`.
            // So `MyAnalyticsService` MUST take `UpdateBktSkillMetricsRequest`.
            // So `PerformanceService` should probably also take it to be consistent, or `MyAnalyticsService` maps it.
            // Mapping is fine.
            let service = PerformanceService::new(self.pool.clone());
            service.update_bkt_skill_metrics(Request::new(())).await
        }

        async fn batch_track_events(
            &self,
            request: Request<BatchEventRequest>,
        ) -> Result<Response<BatchEventResponse>, Status> {
            let service = EngagementService::new(self.pool.clone());
            service.batch_track_events(request).await
        }

        async fn get_collaborative_recommendations(
            &self,
            request: Request<CollaborativeRecommendationRequest>,
        ) -> Result<Response<CollaborativeRecommendationResponse>, Status> {
            let service = RecommendationService::new(self.pool.clone());
            service.get_collaborative_recommendations(request).await
        }

        async fn get_trending_paths(
            &self,
            request: Request<TrendingPathsRequest>,
        ) -> Result<Response<TrendingPathsResponse>, Status> {
            let service = RecommendationService::new(self.pool.clone());
            service.get_trending_paths(request).await
        }

        async fn get_path_analytics(
            &self,
            request: Request<PathAnalyticsRequest>,
        ) -> Result<Response<PathAnalyticsResponse>, Status> {
            let service = LearningService::new(self.pool.clone());
            service.get_path_analytics(request).await
        }

        async fn get_cohort_analytics(
            &self,
            request: Request<GetCohortAnalyticsRequest>,
        ) -> Result<Response<CohortAnalyticsResponse>, Status> {
            let service = LearningService::new(self.pool.clone());
            service.get_cohort_analytics(request).await
        }

        async fn get_quiz_attempt_history(
            &self,
            request: Request<QuizAttemptHistoryRequest>,
        ) -> Result<Response<QuizAttemptHistoryResponse>, Status> {
            let service = EngagementService::new(self.pool.clone());
            service.get_quiz_attempt_history(request).await
        }

        async fn get_related_resources(
            &self,
            request: Request<RelatedResourcesRequest>,
        ) -> Result<Response<RelatedResourcesResponse>, Status> {
            let service = RecommendationService::new(self.pool.clone());
            service.get_related_resources(request).await
        }

        async fn generate_study_recommendations(
            &self,
            request: Request<StudyRecommendationsRequest>,
        ) -> Result<Response<StudyRecommendationsResponse>, Status> {
            let service = RecommendationService::new(self.pool.clone());
            service.generate_study_recommendations(request).await
        }

        async fn generate_next_steps(
            &self,
            request: Request<NextStepsRequest>,
        ) -> Result<Response<NextStepsResponse>, Status> {
            let service = RecommendationService::new(self.pool.clone());
            service.generate_next_steps(request).await
        }

        async fn predict_bkt(
            &self,
            request: Request<PredictBktRequest>,
        ) -> Result<Response<PredictBktResponse>, Status> {
            let service = PerformanceService::new(self.pool.clone());
            service.predict_bkt(request).await
        }

        async fn predict_burn_model(
            &self,
            request: Request<PredictBurnRequest>,
        ) -> Result<Response<PredictBurnResponse>, Status> {
            let service = PerformanceService::new(self.pool.clone());
            service.predict_burn_model(request).await
        }

        async fn get_focus_recommendations(
            &self,
            request: Request<GetFocusRecommendationsRequest>,
        ) -> Result<Response<GetFocusRecommendationsResponse>, Status> {
            let req = request.into_inner();
            let user_id = req.user_id;
            let limit = if req.limit <= 0 { 5 } else { req.limit };

            if user_id.is_empty() {
                return Err(Status::invalid_argument("user_id cannot be empty"));
            }

            let analyzer = SpacedRepetitionAnalytics::new(self.pool.clone());
            match analyzer.get_focus_recommendations(&user_id, limit).await {
                Ok(results) => {
                    let areas = results
                        .into_iter()
                        .map(|(topic, card_count, pass_rate)| FocusArea {
                            topic,
                            card_count,
                            pass_rate,
                        })
                        .collect();
                    Ok(Response::new(GetFocusRecommendationsResponse { areas }))
                }
                Err(e) => Err(Status::internal(format!(
                    "Focus recommendations failed: {}",
                    e
                ))),
            }
        }

        async fn get_due_cards(
            &self,
            request: Request<GetDueCardsRequest>,
        ) -> Result<Response<GetDueCardsResponse>, Status> {
            let req = request.into_inner();
            let user_id = req.user_id;

            if user_id.is_empty() {
                return Err(Status::invalid_argument("user_id cannot be empty"));
            }

            let analyzer = SpacedRepetitionAnalytics::new(self.pool.clone());
            match analyzer.get_due_cards(&user_id, 100).await {
                Ok(rows) => {
                    let cards = rows
                        .into_iter()
                        .map(|(card_id, topic_id, question, next_review)| DueCard {
                            card_id,
                            topic_id: topic_id.unwrap_or_default(),
                            question,
                            due: next_review.to_rfc3339(),
                        })
                        .collect();
                    Ok(Response::new(GetDueCardsResponse { cards }))
                }
                Err(e) => Err(Status::internal(format!(
                    "Failed to get due cards: {}",
                    e
                ))),
            }
        }

        async fn get_spaced_repetition_stats(
            &self,
            request: Request<GetSpacedRepetitionStatsRequest>,
        ) -> Result<Response<GetSpacedRepetitionStatsResponse>, Status> {
            let req = request.into_inner();
            let user_id = req.user_id;

            if user_id.is_empty() {
                return Err(Status::invalid_argument("user_id cannot be empty"));
            }

            let analyzer = SpacedRepetitionAnalytics::new(self.pool.clone());
            match analyzer.get_user_stats(&user_id).await {
                Ok(stats) => Ok(Response::new(GetSpacedRepetitionStatsResponse {
                    stats: Some(SpacedRepetitionStatsProto {
                        total_cards: stats.total_cards,
                        due_today: stats.due_today,
                        mastered_cards: stats.mastered_cards,
                        learning_cards: stats.learning_cards,
                        relearning_cards: stats.relearning_cards,
                        avg_ease_factor: stats.avg_ease_factor,
                        avg_interval_days: stats.avg_interval_days,
                        recent_pass_rate: stats.recent_pass_rate,
                    }),
                })),
                Err(e) => Err(Status::internal(format!(
                    "Failed to get spaced repetition stats: {}",
                    e
                ))),
            }
        }

        async fn get_focus_correlation(
            &self,
            request: Request<GetFocusCorrelationRequest>,
        ) -> Result<Response<GetFocusCorrelationResponse>, Status> {
            let service = LearningService::new(self.pool.clone());
            service.get_focus_correlation(request).await
        }
    }
}

#[cfg(feature = "ml")]
pub use inner::*;

#[cfg(not(feature = "ml"))]
use crate::analytics_proto::*;
#[cfg(not(feature = "ml"))]
use tonic::{Request, Response, Status};

#[cfg(not(feature = "ml"))]
pub struct MyAnalyticsService {
    _private: (),
}

#[cfg(not(feature = "ml"))]
impl MyAnalyticsService {
    pub fn new(_pool: sqlx::Pool<sqlx::Postgres>) -> Self {
        Self { _private: () }
    }
}

#[cfg(not(feature = "ml"))]
#[tonic::async_trait]
impl crate::analytics_proto::analytics_service_server::AnalyticsService for MyAnalyticsService {
    async fn get_health(
        &self,
        _request: Request<HealthRequest>,
    ) -> Result<Response<HealthResponse>, Status> {
        Ok(Response::new(HealthResponse {
            status: "ok".to_string(),
            timestamp: chrono::Utc::now().to_rfc3339(),
        }))
    }

    async fn predict_performance(
        &self,
        _req: Request<PredictPerformanceRequest>,
    ) -> Result<Response<PredictPerformanceResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_engagement_metrics(
        &self,
        _req: Request<GetEngagementMetricsRequest>,
    ) -> Result<Response<GetEngagementMetricsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_recommendations(
        &self,
        _req: Request<GetRecommendationsRequest>,
    ) -> Result<Response<GetRecommendationsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn update_attempt_metrics(
        &self,
        _req: Request<AttemptMetricsRequest>,
    ) -> Result<Response<UpdateAttemptMetricsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_user_ability(
        &self,
        _req: Request<GetUserAbilityRequest>,
    ) -> Result<Response<GetUserAbilityResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_next_adaptive_question(
        &self,
        _req: Request<GetNextAdaptiveQuestionRequest>,
    ) -> Result<Response<GetNextAdaptiveQuestionResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn update_bkt(
        &self,
        _req: Request<UpdateBktRequest>,
    ) -> Result<Response<UpdateBktResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_user_learning_summary(
        &self,
        _req: Request<GetUserLearningSummaryRequest>,
    ) -> Result<Response<UserLearningSummaryResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_goal_analytics(
        &self,
        _req: Request<GetGoalAnalyticsRequest>,
    ) -> Result<Response<LearningGoalAnalyticsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_course_statistics(
        &self,
        _req: Request<GetCourseStatisticsRequest>,
    ) -> Result<Response<CourseStatsResultResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_learning_path_statistics(
        &self,
        _req: Request<GetLearningPathStatisticsRequest>,
    ) -> Result<Response<LearningPathStatsResultResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_detailed_learning_analytics(
        &self,
        _req: Request<GetDetailedLearningAnalyticsRequest>,
    ) -> Result<Response<GetDetailedLearningAnalyticsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn calculate_course_progress(
        &self,
        _req: Request<CalculateCourseProgressRequest>,
    ) -> Result<Response<CourseProgress>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_user_data_for_profile(
        &self,
        _req: Request<GetUserDataForProfileRequest>,
    ) -> Result<Response<GetUserDataForProfileResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_user_feature_vector(
        &self,
        _req: Request<GetUserFeatureVectorRequest>,
    ) -> Result<Response<GetUserFeatureVectorResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_filtered_recommendations(
        &self,
        _req: Request<crate::analytics_proto::GetFilteredRecommendationsRequest>,
    ) -> Result<Response<crate::analytics_proto::GetFilteredRecommendationsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn update_bkt_skill_metrics(
        &self,
        _req: Request<crate::analytics_proto::UpdateBktSkillMetricsRequest>,
    ) -> Result<Response<crate::analytics_proto::UpdateBktSkillMetricsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn batch_track_events(
        &self,
        _req: Request<BatchEventRequest>,
    ) -> Result<Response<BatchEventResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_collaborative_recommendations(
        &self,
        _req: Request<CollaborativeRecommendationRequest>,
    ) -> Result<Response<CollaborativeRecommendationResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_trending_paths(
        &self,
        _req: Request<TrendingPathsRequest>,
    ) -> Result<Response<TrendingPathsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_path_analytics(
        &self,
        _req: Request<PathAnalyticsRequest>,
    ) -> Result<Response<PathAnalyticsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }
    async fn get_cohort_analytics(
        &self,
        _request: Request<GetCohortAnalyticsRequest>,
    ) -> Result<Response<CohortAnalyticsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }
    async fn get_quiz_attempt_history(
        &self,
        _req: Request<QuizAttemptHistoryRequest>,
    ) -> Result<Response<QuizAttemptHistoryResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_related_resources(
        &self,
        _req: Request<RelatedResourcesRequest>,
    ) -> Result<Response<RelatedResourcesResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn generate_study_recommendations(
        &self,
        _req: Request<StudyRecommendationsRequest>,
    ) -> Result<Response<StudyRecommendationsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn generate_next_steps(
        &self,
        _req: Request<NextStepsRequest>,
    ) -> Result<Response<NextStepsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn predict_bkt(
        &self,
        _req: Request<PredictBktRequest>,
    ) -> Result<Response<PredictBktResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn predict_burn_model(
        &self,
        _req: Request<PredictBurnRequest>,
    ) -> Result<Response<PredictBurnResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_focus_recommendations(
        &self,
        _req: Request<GetFocusRecommendationsRequest>,
    ) -> Result<Response<GetFocusRecommendationsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_due_cards(
        &self,
        _req: Request<GetDueCardsRequest>,
    ) -> Result<Response<GetDueCardsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_spaced_repetition_stats(
        &self,
        _req: Request<GetSpacedRepetitionStatsRequest>,
    ) -> Result<Response<GetSpacedRepetitionStatsResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }

    async fn get_focus_correlation(
        &self,
        _req: Request<GetFocusCorrelationRequest>,
    ) -> Result<Response<GetFocusCorrelationResponse>, Status> {
        Err(Status::unimplemented("ML feature disabled"))
    }
}
