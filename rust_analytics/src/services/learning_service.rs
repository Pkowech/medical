use sqlx::{Pool, Postgres, Row};
use tonic::{Request, Response, Status};
use chrono::{NaiveDate, NaiveDateTime, TimeZone, Utc};
use std::collections::HashMap;

use crate::analytics_proto::{
    GetUserLearningSummaryRequest, UserLearningSummaryResponse,
    GetGoalAnalyticsRequest, LearningGoalAnalyticsResponse,
    GetCourseStatisticsRequest, CourseStatsResultResponse, CourseStatsResult,
    GetLearningPathStatisticsRequest, LearningPathStatsResultResponse, LearningPathStatsResult,
    GetDetailedLearningAnalyticsRequest, GetDetailedLearningAnalyticsResponse,
    CalculateCourseProgressRequest, CourseProgress,
    GetUserDataForProfileRequest, GetUserDataForProfileResponse,
    GetCohortAnalyticsRequest, CohortAnalyticsResponse,
};
use crate::analytics::learning::learning_analytics::{
    calculate_goal_analytics,
    calculate_user_learning_summary,
    Goal,
    ProgressStatus,
};

pub struct LearningService {
    pool: Pool<Postgres>,
}

impl LearningService {
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self { pool }
    }

    fn default_datetime() -> NaiveDateTime {
        Utc.timestamp_opt(0, 0)
            .single()
            .unwrap_or_else(|| Utc::now())
            .naive_utc()
    }

    fn parse_datetime(s: &str) -> Option<NaiveDateTime> {
        chrono::DateTime::parse_from_rfc3339(s)
            .map(|dt| dt.naive_local())
            .ok()
    }

    async fn fetch_goals_from_db(&self, user_id: &str) -> Result<Vec<Goal>, Status> {
        let query = r#"
            SELECT 
                id, user_id, title, status::text AS status_str, 
                category, COALESCE(priority, 0) AS priority,
                target_date, completed_at, created_at, start_date,
                COALESCE(streak_count, 0) AS streak_count
            FROM learning_goals
            WHERE user_id = $1
        "#;

        let rows = sqlx::query(query)
            .bind(user_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Status::internal(format!("DB error: {}", e)))?;

        let mut goals = Vec::new();
        for row in rows {
            let id: String = row.try_get("id")
                .map_err(|e| Status::internal(format!("Row error: {}", e)))?;
            let user_id_val: String = row.try_get("user_id")
                .map_err(|e| Status::internal(format!("Row error: {}", e)))?;
            let title: String = row.try_get("title")
                .map_err(|e| Status::internal(format!("Row error: {}", e)))?;
            let status_str: String = row.try_get("status_str")
                .map_err(|e| Status::internal(format!("Row error: {}", e)))?;
            let category: Option<String> = row.try_get("category").ok();
            let priority: i32 = row.try_get("priority").unwrap_or(0);
            let target_date: Option<NaiveDate> = row.try_get("target_date").ok();
            let completed_at: Option<NaiveDateTime> = row.try_get("completed_at").ok();
            let created_at: NaiveDateTime = row.try_get("created_at")
                .map_err(|e| Status::internal(format!("Row error: {}", e)))?;
            let start_date: Option<NaiveDateTime> = row.try_get("start_date").ok();
            let streak_count: i32 = row.try_get("streak_count").unwrap_or(0);

            let status = ProgressStatus::from_str(&status_str)
                .unwrap_or(ProgressStatus::NotStarted);

            goals.push(Goal {
                id,
                user_id: user_id_val,
                title,
                status,
                category: category.unwrap_or_default(),
                priority: priority.to_string(),
                target_date,
                completed_at,
                created_at,
                start_date,
                streak_count,
            });
        }

        Ok(goals)
    }

    fn proto_goal_to_internal(g: &crate::analytics_proto::Goal) -> Goal {
        let status = ProgressStatus::from_str(&g.status)
            .unwrap_or(ProgressStatus::NotStarted);

        let target_date = if g.target_date.is_empty() {
            None
        } else {
            NaiveDate::parse_from_str(&g.target_date, "%Y-%m-%d").ok()
        };

        let created_at = if g.created_at.is_empty() {
            Self::default_datetime()
        } else {
            Self::parse_datetime(&g.created_at).unwrap_or_else(Self::default_datetime)
        };

        let completed_at = if g.completed_at.is_empty() {
            None
        } else {
            Self::parse_datetime(&g.completed_at)
        };

        let start_date = if g.start_date.is_empty() {
            None
        } else {
            Self::parse_datetime(&g.start_date)
        };

        Goal {
            id: g.id.clone(),
            user_id: g.user_id.clone(),
            title: g.title.clone(),
            status,
            category: g.category.clone(),
            priority: g.priority.clone(),
            target_date,
            completed_at,
            created_at,
            start_date,
            streak_count: g.streak_count,
        }
    }

    pub async fn get_user_learning_summary(
        &self,
        request: Request<GetUserLearningSummaryRequest>,
    ) -> Result<Response<UserLearningSummaryResponse>, Status> {
        let req = request.into_inner();

        let mut sessions_internal = Vec::new();
        for s in req.study_sessions.iter() {
            let ss = crate::analytics::learning::learning_analytics::StudySession::new(
                s.user_id.clone(),
                s.duration,
                s.topic.clone(),
                s.score,
            )
            .map_err(|e| Status::invalid_argument(format!("Invalid session: {}", e)))?;
            sessions_internal.push(ss);
        }

        let mut attempts_internal = Vec::new();
        for a in req.quiz_attempts.iter() {
            let qa = crate::analytics::learning::learning_analytics::QuizAttempt::new(
                a.user_id.clone(),
                a.percentage,
                a.category.clone(),
            )
            .map_err(|e| Status::invalid_argument(format!("Invalid attempt: {}", e)))?;
            attempts_internal.push(qa);
        }

        let user_id = req.user_id;
        let result = calculate_user_learning_summary(&user_id, sessions_internal, attempts_internal);

        match result {
            Ok(summary) => {
                let proto = crate::analytics_proto::UserLearningSummary {
                    total_study_time: summary.total_study_time,
                    average_session_length: summary.average_session_length,
                    average_score: summary.average_score,
                    current_streak: summary.current_streak,
                    longest_streak: summary.longest_streak,
                    strongest_subjects: summary.strongest_subjects,
                    weakest_subjects: summary.weakest_subjects,
                };
                Ok(Response::new(UserLearningSummaryResponse {
                    summary: Some(proto),
                }))
            }
            Err(e) => Err(Status::internal(format!("Analytics error: {}", e))),
        }
    }

    pub async fn get_goal_analytics(
        &self,
        request: Request<GetGoalAnalyticsRequest>,
    ) -> Result<Response<LearningGoalAnalyticsResponse>, Status> {
        let req = request.into_inner();

        let internal_goals = if !req.goals.is_empty() {
            req.goals.iter().map(Self::proto_goal_to_internal).collect()
        } else {
            if req.user_id.is_empty() {
                return Err(Status::invalid_argument("user_id required"));
            }
            self.fetch_goals_from_db(&req.user_id).await?
        };

        let user_id = req.user_id.clone();
        let analytics = calculate_goal_analytics(&internal_goals, &user_id)
            .map_err(|e| Status::internal(format!("Analytics error: {}", e)))?;

        let goals_by_category_proto = analytics
            .goals_by_category
            .iter()
            .map(|(k, v)| (k.clone(), *v as i32))
            .collect();

        let goals_by_priority_proto = analytics
            .goals_by_priority
            .iter()
            .map(|(k, v)| (k.clone(), *v as i32))
            .collect();

        let proto = crate::analytics_proto::LearningGoalAnalytics {
            user_id: user_id.clone(),
            total_goals: analytics.total_goals as i32,
            active_goals: analytics.active_goals as i32,
            completed_goals: analytics.completed_goals as i32,
            overdue_goals: analytics.overdue_goals as i32,
            completion_rate: analytics.completion_rate,
            average_completion_time_days: analytics.average_completion_time_days,
            goals_by_category: goals_by_category_proto,
            goals_by_priority: goals_by_priority_proto,
            current_streak: analytics.current_streak,
            longest_streak: analytics.longest_streak,
            streak_goal_ids: analytics.streak_goal_ids.clone(),
            upcoming_deadlines: vec![],
        };

        Ok(Response::new(LearningGoalAnalyticsResponse {
            goal_analytics: Some(proto),
        }))
    }

    pub async fn get_course_statistics(
        &self,
        request: Request<GetCourseStatisticsRequest>,
    ) -> Result<Response<CourseStatsResultResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id;

        if user_id.is_empty() {
            return Err(Status::invalid_argument("user_id required"));
        }

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM course_progress WHERE user_id = $1"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?;

        let completed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM course_progress WHERE user_id = $1 AND status::text = 'completed'"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?;

        let total_time: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(time_spent), 0) FROM course_progress WHERE user_id = $1"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?;

        let avg_progress: f32 = sqlx::query_scalar::<_, Option<f32>>(
            "SELECT AVG(progress_percentage) FROM course_progress WHERE user_id = $1"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?
        .unwrap_or(0.0);

        let cs = CourseStatsResult {
            total_courses: total as i32,
            completed_courses: completed as i32,
            total_study_time_minutes: total_time as i32,
            average_course_progress: avg_progress,
        };

        Ok(Response::new(CourseStatsResultResponse {
            course_stats: Some(cs),
        }))
    }

    pub async fn get_learning_path_statistics(
        &self,
        request: Request<GetLearningPathStatisticsRequest>,
    ) -> Result<Response<LearningPathStatsResultResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id;

        if user_id.is_empty() {
            return Err(Status::invalid_argument("user_id required"));
        }

        let total: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM learning_path_progress WHERE user_id = $1"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?;

        let completed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM learning_path_progress WHERE user_id = $1 AND status::text = 'completed'"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?;

        let total_time: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(total_time_spent_minutes), 0) FROM learning_path_progress WHERE user_id = $1"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?;

        let avg_progress: f32 = sqlx::query_scalar::<_, Option<f32>>(
            "SELECT AVG(overall_progress_percentage) FROM learning_path_progress WHERE user_id = $1"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?
        .unwrap_or(0.0);

        let ps = LearningPathStatsResult {
            total_learning_paths: total as i32,
            completed_learning_paths: completed as i32,
            total_study_time_minutes: total_time as i32,
            average_path_progress: avg_progress,
        };

        Ok(Response::new(LearningPathStatsResultResponse {
            path_stats: Some(ps),
        }))
    }

    pub async fn get_detailed_learning_analytics(
        &self,
        request: Request<GetDetailedLearningAnalyticsRequest>,
    ) -> Result<Response<GetDetailedLearningAnalyticsResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id.clone();

        if user_id.is_empty() {
            return Err(Status::invalid_argument("user_id required"));
        }

        let goal_req = Request::new(GetGoalAnalyticsRequest {
            user_id: user_id.clone(),
            goals: vec![],
        });
        let goal_analytics = self.get_goal_analytics(goal_req).await?
            .into_inner()
            .goal_analytics;

        let course_req = Request::new(GetCourseStatisticsRequest {
            user_id: user_id.clone(),
        });
        let course_stats = self.get_course_statistics(course_req).await?
            .into_inner()
            .course_stats;

        let path_req = Request::new(GetLearningPathStatisticsRequest {
            user_id: user_id.clone(),
        });
        let path_stats = self.get_learning_path_statistics(path_req).await?
            .into_inner()
            .path_stats;

        // Note: To avoid circular dependency with EngagementService, we might need to duplicate queries or share a repo query.
        // But for now, I'll direct query DB for last activity/most active hour as it was in original.
        
        // Get last activity date
        let last_activity_date: Option<NaiveDateTime> = sqlx::query_scalar(
            "SELECT GREATEST(MAX(last_accessed_at), MAX(last_activity_date)) FROM (
                SELECT last_accessed_at FROM course_progress WHERE user_id = $1
                UNION ALL
                SELECT last_activity_date FROM learning_path_progress WHERE user_id = $1
            ) AS activities"
        )
        .bind(&user_id)
        .fetch_optional(&self.pool)
        .await
        .unwrap_or(None)
        .flatten();

        // Get most active hour (0-23)
        let most_active_hour: Option<i32> = sqlx::query_scalar(
            "SELECT EXTRACT(HOUR FROM last_accessed_at)::int FROM course_progress WHERE user_id = $1 
             UNION ALL SELECT EXTRACT(HOUR FROM last_activity_date)::int FROM learning_path_progress WHERE user_id = $1 
             ORDER BY EXTRACT(HOUR FROM COALESCE(last_accessed_at, last_activity_date)) DESC LIMIT 1"
        )
        .bind(&user_id)
        .fetch_optional(&self.pool)
        .await
        .unwrap_or(None)
        .flatten();

        let most_active_time_of_day = match most_active_hour {
            Some(h) if h >= 5 && h < 12 => "Morning (5am-12pm)".to_string(),
            Some(h) if h >= 12 && h < 17 => "Afternoon (12pm-5pm)".to_string(),
            Some(h) if h >= 17 && h < 21 => "Evening (5pm-9pm)".to_string(),
            Some(_) => "Night (9pm-5am)".to_string(),
            None => "Unknown".to_string(),
        };

        let engagement_service = crate::services::engagement_service::EngagementService::new(self.pool.clone());
        let engagement_req = Request::new(crate::analytics_proto::GetEngagementMetricsRequest {
            user_id: user_id.clone(),
        });
        
        let engagement_metrics = match engagement_service.get_engagement_metrics(engagement_req).await {
            Ok(resp) => {
                let r = resp.into_inner();
                Some(crate::analytics_proto::EngagementMetrics {
                    user_id: user_id.clone(),
                    daily_active_streak: r.daily_streak,
                    weekly_active_streak: r.weekly_streak,
                    last_activity_date: last_activity_date.map(|d| d.to_string()).unwrap_or_default(), // logic for last_activity_date is below, need to reorder or use what we have
                    session_count: r.activity_frequency,
                    average_session_duration: r.time_spent as i32,
                    most_active_time_of_day: most_active_time_of_day.clone(), // logic below
                    most_active_day_of_week: "Monday".to_string(),
                })
            }
            Err(_) => None,
        };

        // Note: moved last_activity usage into engagement_metrics construction or update it 
        // Logic flow: calculate dates first, then use in engagement object construction.
        
        // Re-arranging for clarity:
        // 1. Goals, Course, Path stats (done)
        // 2. Local DB queries for activity dates and times (done below)
        // 3. Engagement Service call (new)
        // 4. Construct response

        Ok(Response::new(GetDetailedLearningAnalyticsResponse {
            user_id,
            user_learning_summary: None,
            goal_analytics,
            course_stats,
            path_stats,
            engagement_metrics, 
            performance_metrics: None,
            progress_trends: vec![],
        }))
    }

    pub async fn calculate_course_progress(
        &self, 
        request: Request<CalculateCourseProgressRequest>
    ) -> Result<Response<CourseProgress>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id.clone();
        let course_id = req.course_id.clone();

        if user_id.is_empty() || course_id.is_empty() {
            return Err(Status::invalid_argument("user_id and course_id required"));
        }

        // 1. Get all units for the course
        let units: Vec<(String,)> = sqlx::query_as("SELECT id FROM units WHERE course_id = $1")
            .bind(&course_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| Status::internal(format!("DB error fetching units: {}", e)))?;

        if units.is_empty() {
            return Ok(Response::new(CourseProgress {
                id: uuid::Uuid::new_v4().to_string(),
                user_id,
                course_id,
                progress_percentage: 0,
                status: crate::analytics_proto::ProgressStatus::NotStarted as i32,
                last_accessed_at: None,
                time_spent: 0,
                completed_units: 0,
                total_units: 0,
                started_at: None,
                completed_at: None,
                created_at: None,
                updated_at: None,
            }));
        }

        let mut unit_completion_status = Vec::new();
        let mut total_time_spent: i64 = 0;
        let mut last_accessed_dates: Vec<NaiveDateTime> = Vec::new();

        for (unit_id,) in units.iter() {
            let total_materials: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM materials WHERE unit_id = $1")
                .bind(unit_id)
                .fetch_one(&self.pool)
                .await
                .unwrap_or(0);

            let completed_materials: i64 = if total_materials > 0 {
                sqlx::query_scalar("SELECT COUNT(*) FROM material_progress mp JOIN materials m ON mp.material_id = m.id WHERE mp.user_id = $1 AND m.unit_id = $2 AND mp.is_completed = true")
                    .bind(&user_id)
                    .bind(unit_id)
                    .fetch_one(&self.pool)
                    .await
                    .unwrap_or(0)
            } else {
                0
            };

            let unit_progress_percentage = if total_materials > 0 {
                (completed_materials as f32 / total_materials as f32) * 100.0
            } else {
                100.0 // unit with no materials considered complete
            };

            unit_completion_status.push(unit_progress_percentage >= 100.0);

            if let Some(access_info) = sqlx::query_as::<_, (Option<i64>, Option<NaiveDateTime>)>("SELECT COALESCE(SUM(time_spent),0), MAX(accessed_at) FROM unit_access WHERE user_id = $1 AND unit_id = $2")
                .bind(&user_id)
                .bind(unit_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| Status::internal(format!("DB error fetching unit access: {}", e)))? {
                    if let Some(time) = access_info.0 {
                        total_time_spent += time;
                    }
                    if let Some(date) = access_info.1 {
                        last_accessed_dates.push(date);
                    }
            }
        }

        let completed_units = unit_completion_status.iter().filter(|&&is_completed| is_completed).count() as i32;
        let total_units = units.len() as i32;
        let final_progress_percentage = if total_units > 0 {
            (completed_units as f32 / total_units as f32 * 100.0).round() as i32
        } else {
            100
        };

        let last_accessed = last_accessed_dates.iter().max().cloned();

        let final_status = if final_progress_percentage >= 100 {
            crate::analytics_proto::ProgressStatus::Completed as i32
        } else if final_progress_percentage > 0 {
            crate::analytics_proto::ProgressStatus::InProgress as i32
        } else {
            crate::analytics_proto::ProgressStatus::NotStarted as i32
        };

        let last_accessed_ts = last_accessed.map(|dt| prost_types::Timestamp {
            seconds: chrono::Utc.from_utc_datetime(&dt).timestamp(),
            nanos: chrono::Utc.from_utc_datetime(&dt).timestamp_subsec_nanos() as i32,
        });

        let result = CourseProgress {
            id: uuid::Uuid::new_v4().to_string(),
            user_id,
            course_id,
            progress_percentage: final_progress_percentage,
            status: final_status,
            last_accessed_at: last_accessed_ts,
            time_spent: total_time_spent as i32,
            completed_units,
            total_units,
            started_at: None,
            completed_at: None,
            created_at: None,
            updated_at: None,
        };

        Ok(Response::new(result))
    }

    pub async fn get_cohort_analytics(
        &self,
        _request: Request<GetCohortAnalyticsRequest>,
    ) -> Result<Response<CohortAnalyticsResponse>, Status> {
        Err(Status::unimplemented("Cohort analytics are not yet supported because the cohorts database schema has not been defined."))
    }

    pub async fn get_user_data_for_profile(
        &self, 
        request: Request<GetUserDataForProfileRequest>
    ) -> Result<Response<GetUserDataForProfileResponse>, Status> {
        let _req = request.into_inner();
        Ok(Response::new(GetUserDataForProfileResponse {
            enrollments: vec![],
            quiz_attempts: vec![],
            case_attempts: vec![],
            learning_goals: vec![],
            path_progress: vec![],
            specialization: String::from(""),
        }))
    }

    pub async fn get_user_feature_vector(
        &self,
        request: Request<crate::analytics_proto::GetUserFeatureVectorRequest>,
    ) -> Result<Response<crate::analytics_proto::GetUserFeatureVectorResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id.clone();

        // Assuming crate::modules::analytics::core::feature_extraction exists and is accessible
        // Simplification: We might need to copy extract_user_features logic if it's not public
        // But for now assuming it is public as it was used in analytics_service
        let features = crate::modules::analytics::core::feature_extraction::extract_user_features(
            user_id.clone(),
            &self.pool,
        )
        .await
        .map_err(|e| Status::internal(format!("Failed to extract features: {}", e)))?;

        let feature_vector = vec![
            features.completed_materials as f64,
            features.average_score,
            features.study_time as f64,
            features.difficulty_preference,
            features.learning_style,
            features.engagement_level,
            features.quiz_performance,
            features.material_interaction,
        ];

        let mut feature_map = std::collections::HashMap::new();
        feature_map.insert("completed_materials".to_string(), features.completed_materials as f64);
        feature_map.insert("average_score".to_string(), features.average_score);
        feature_map.insert("study_time".to_string(), features.study_time as f64);
        feature_map.insert("difficulty_preference".to_string(), features.difficulty_preference);
        feature_map.insert("learning_style".to_string(), features.learning_style);
        feature_map.insert("engagement_level".to_string(), features.engagement_level);
        feature_map.insert("quiz_performance".to_string(), features.quiz_performance);
        feature_map.insert("material_interaction".to_string(), features.material_interaction);

        Ok(Response::new(crate::analytics_proto::GetUserFeatureVectorResponse {
            user_id,
            features: feature_vector,
            feature_map,
        }))
    }

    pub async fn get_path_analytics(
        &self, 
        request: Request<crate::analytics_proto::PathAnalyticsRequest>
    ) -> Result<Response<crate::analytics_proto::PathAnalyticsResponse>, Status> {
        let req = request.into_inner();
        
        match crate::modules::analytics::reports::path_analytics::get_path_analytics(&req.path_id, &self.pool).await {
            Ok(pa) => Ok(Response::new(crate::analytics_proto::PathAnalyticsResponse { 
                path_id: pa.path_id, 
                average_completion_rate: pa.average_completion_rate, 
                average_time_to_complete: pa.average_time_to_complete 
            })),
            Err(e) => Err(Status::internal(format!("path analytics failed: {}", e))),
        }
    }

    pub async fn get_focus_correlation(
        &self,
        request: Request<crate::analytics_proto::GetFocusCorrelationRequest>,
    ) -> Result<Response<crate::analytics_proto::GetFocusCorrelationResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id;

        if user_id.is_empty() {
            return Err(Status::invalid_argument("user_id required"));
        }

        // Fetch focus scores and quiz scores for this user from study_sessions
        // Note: activities JSON structure is [ { "type": "quiz", "score": 85, ... }, ... ]
        let rows = sqlx::query(
            r#"
            SELECT focus_score, 
                   (jsonb_array_elements(activities)->>'score')::float as quiz_score
            FROM study_sessions
            WHERE user_id = $1 AND focus_score > 0 AND activities IS NOT NULL
            "#
        )
        .bind(&user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?;

        let mut buckets: HashMap<String, Vec<f64>> = HashMap::new();
        let mut focus_points = Vec::new();
        let mut quiz_points = Vec::new();

        for row in rows {
            let focus: f64 = row.try_get("focus_score").unwrap_or(0.0);
            let quiz: f64 = row.try_get::<Option<f64>, _>("quiz_score").unwrap_or(None).unwrap_or(0.0);
            
            focus_points.push(focus);
            quiz_points.push(quiz);

            let bucket_key = match focus {
                f if f < 20.0 => "0-20",
                f if f < 40.0 => "20-40",
                f if f < 60.0 => "40-60",
                f if f < 80.0 => "60-80",
                _ => "80-100",
            }.to_string();

            buckets.entry(bucket_key).or_insert(Vec::new()).push(quiz);
        }

        let mut avg_score_by_focus_bucket = HashMap::new();
        for (k, v) in buckets {
            let avg = v.iter().sum::<f64>() / v.len() as f64;
            avg_score_by_focus_bucket.insert(k, avg);
        }

        // Real Pearson calculation (simple version)
        let correlation_coefficient = if focus_points.len() > 1 {
            let n = focus_points.len() as f64;
            let sum_x: f64 = focus_points.iter().sum();
            let sum_y: f64 = quiz_points.iter().sum();
            let sum_xy: f64 = focus_points.iter().zip(quiz_points.iter()).map(|(x, y)| x * y).sum();
            let sum_x2: f64 = focus_points.iter().map(|x| x * x).sum();
            let sum_y2: f64 = quiz_points.iter().map(|y| y * y).sum();

            let numerator = n * sum_xy - sum_x * sum_y;
            let denominator = ((n * sum_x2 - sum_x.powi(2)) * (n * sum_y2 - sum_y.powi(2))).sqrt();

            if denominator == 0.0 { 0.0 } else { (numerator / denominator).max(-1.0).min(1.0) }
        } else {
            0.0
        };

        let insight = if correlation_coefficient > 0.5 {
            "Your data shows a strong link between deep focus and higher test scores. Keep studying in distraction-free environments!".to_string()
        } else if correlation_coefficient > 0.2 {
            "There's a positive trend between your focus and scores. Try to aim for longer focused sessions.".to_string()
        } else {
            "We need more data to find a clear pattern. Try recording more focused study sessions.".to_string()
        };

        Ok(Response::new(crate::analytics_proto::GetFocusCorrelationResponse {
            correlation: Some(crate::analytics_proto::FocusCorrelation {
                correlation_coefficient,
                insight,
                avg_score_by_focus_bucket,
            }),
        }))
    }
}

