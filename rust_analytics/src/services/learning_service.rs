use sqlx::{Pool, Postgres, Row};
use tonic::{Request, Response, Status};
use chrono::{NaiveDate, NaiveDateTime, TimeZone, Utc};
use std::collections::HashMap;

use crate::analytics_proto::{
    GetUserLearningSummaryRequest, UserLearningSummaryResponse,
    GetGoalAnalyticsRequest, LearningGoalAnalyticsResponse,
    GetCourseStatisticsRequest, CourseStatsResultResponse, CourseStatsResult,
    GetCourseAnalyticsRequest, CourseAnalyticsResponse, CourseUnitPopularity,
    StrugglingStudent,
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
            "SELECT COUNT(*) FROM course_enrollments WHERE user_id = $1"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?;

        let completed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM course_enrollments WHERE user_id = $1 AND status::text IN ('completed', 'COMPLETED')"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?;

        let total_time: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(ss.duration), 0)
             FROM study_sessions ss
             LEFT JOIN topics t ON t.id = ss.topic_id
             LEFT JOIN materials m ON m.id = ss.material_id
             JOIN units u ON u.id = COALESCE(t.unit_id, m.unit_id)
             WHERE ss.user_id = $1"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?;

        let avg_progress: f64 = sqlx::query_scalar::<_, Option<f64>>(
            "SELECT AVG(progress_percentage) FROM course_enrollments WHERE user_id = $1"
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("DB error: {}", e)))?
        .unwrap_or(0.0);

        let completed_items: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM progress WHERE user_id = $1 AND is_completed = true",
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("Completed-items query failed: {e}")))?;

        let cs = CourseStatsResult {
            total_courses: total as i32,
            completed_courses: completed as i32,
            total_study_time_minutes: total_time.min(i32::MAX as i64) as i32,
            average_course_progress: avg_progress as f32,
            completion_rate: if total > 0 {
                completed as f32 / total as f32
            } else {
                0.0
            },
            completed_items: completed_items.min(i32::MAX as i64) as i32,
        };

        Ok(Response::new(CourseStatsResultResponse {
            course_stats: Some(cs),
        }))
    }

    pub async fn get_course_analytics(
        &self,
        request: Request<GetCourseAnalyticsRequest>,
    ) -> Result<Response<CourseAnalyticsResponse>, Status> {
        let course_id = request.into_inner().course_id;
        if course_id.is_empty() {
            return Err(Status::invalid_argument("course_id required"));
        }

        let (enrollment_count, completed_count): (i64, i64) = sqlx::query_as(
            "SELECT COUNT(*)::bigint,
                    COUNT(*) FILTER (WHERE status::text IN ('completed', 'COMPLETED'))::bigint
             FROM course_enrollments
             WHERE course_id = $1",
        )
        .bind(&course_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Course enrollment query failed: {error}")))?;

        let total_time_spent: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(ua.time_spent), 0)::bigint
             FROM unit_accesses ua
             JOIN units u ON u.id = ua.unit_id
             WHERE u.course_id = $1",
        )
        .bind(&course_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Course study-time query failed: {error}")))?;

        #[derive(sqlx::FromRow)]
        struct UnitPopularity {
            unit_id: String,
            title: String,
            access_count: i64,
        }
        let popular_units = sqlx::query_as::<_, UnitPopularity>(
            "SELECT u.id AS unit_id, u.title, COUNT(ua.id)::bigint AS access_count
             FROM units u
             JOIN unit_accesses ua ON ua.unit_id = u.id
             WHERE u.course_id = $1
             GROUP BY u.id, u.title
             ORDER BY access_count DESC, u.id
             LIMIT 5",
        )
        .bind(&course_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Popular unit query failed: {error}")))?;

        let enrolled_users: Vec<String> = sqlx::query_scalar(
            "SELECT user_id
             FROM course_enrollments
             WHERE course_id = $1
             ORDER BY user_id",
        )
        .bind(&course_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Course enrollment query failed: {error}")))?;

        let mut struggling_students = Vec::new();
        for user_id in enrolled_users {
            let progress =
                crate::modules::analytics::progress_tracking::calculate_course_progress(
                    &self.pool,
                    &user_id,
                    &course_id,
                )
                .await
                .map_err(|error| {
                    Status::internal(format!(
                        "Course progress query failed for user {user_id}: {error}"
                    ))
                })?;
            if progress.progress_percentage < 30 {
                struggling_students.push(StrugglingStudent {
                    user_id,
                    progress_percentage: f64::from(progress.progress_percentage),
                });
            }
        }
        struggling_students.sort_by(|left, right| {
            left.progress_percentage
                .partial_cmp(&right.progress_percentage)
                .unwrap_or(std::cmp::Ordering::Equal)
        });
        struggling_students.truncate(10);

        Ok(Response::new(CourseAnalyticsResponse {
            course_id,
            enrollment_count: enrollment_count.min(i32::MAX as i64) as i32,
            completion_rate: if enrollment_count > 0 {
                completed_count as f64 / enrollment_count as f64 * 100.0
            } else {
                0.0
            },
            average_time_spent: if enrollment_count > 0 {
                total_time_spent as f64 / enrollment_count as f64
            } else {
                0.0
            },
            popular_units: popular_units
                .into_iter()
                .map(|unit| CourseUnitPopularity {
                    unit_id: unit.unit_id,
                    title: unit.title,
                    access_count: unit.access_count.min(i32::MAX as i64) as i32,
                })
                .collect(),
            struggling_students,
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

        let avg_progress: f64 = sqlx::query_scalar::<_, Option<f64>>(
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
            average_path_progress: avg_progress as f32,
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
            "SELECT MAX(activity_at) FROM (
                SELECT last_accessed AS activity_at
                FROM course_enrollments
                WHERE user_id = $1 AND last_accessed IS NOT NULL
                UNION ALL
                SELECT last_activity_date AS activity_at
                FROM learning_path_progress
                WHERE user_id = $1 AND last_activity_date IS NOT NULL
            ) AS activities"
        )
        .bind(&user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Last activity query failed: {error}")))?
        .flatten();

        // Get most active hour (0-23)
        let most_active_hour: Option<i32> = sqlx::query_scalar(
            "SELECT EXTRACT(HOUR FROM activity_at)::int
             FROM (
                 SELECT last_accessed AS activity_at
                 FROM course_enrollments
                 WHERE user_id = $1 AND last_accessed IS NOT NULL
                 UNION ALL
                 SELECT last_activity_date AS activity_at
                 FROM learning_path_progress
                 WHERE user_id = $1 AND last_activity_date IS NOT NULL
             ) AS activities
             GROUP BY EXTRACT(HOUR FROM activity_at)
             ORDER BY COUNT(*) DESC, EXTRACT(HOUR FROM activity_at) ASC
             LIMIT 1"
        )
        .bind(&user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Activity-hour query failed: {error}")))?
        .flatten();

        let most_active_time_of_day = match most_active_hour {
            Some(h) if h >= 5 && h < 12 => "Morning (5am-12pm)".to_string(),
            Some(h) if h >= 12 && h < 17 => "Afternoon (12pm-5pm)".to_string(),
            Some(h) if h >= 17 && h < 21 => "Evening (5pm-9pm)".to_string(),
            Some(_) => "Night (9pm-5am)".to_string(),
            None => "Unknown".to_string(),
        };

        let most_active_day: Option<i32> = sqlx::query_scalar(
            "SELECT EXTRACT(DOW FROM activity_at)::int
             FROM (
                 SELECT last_accessed AS activity_at
                 FROM course_enrollments
                 WHERE user_id = $1 AND last_accessed IS NOT NULL
                 UNION ALL
                 SELECT last_activity_date AS activity_at
                 FROM learning_path_progress
                 WHERE user_id = $1 AND last_activity_date IS NOT NULL
             ) AS activities
             GROUP BY EXTRACT(DOW FROM activity_at)
             ORDER BY COUNT(*) DESC, EXTRACT(DOW FROM activity_at) ASC
             LIMIT 1",
        )
        .bind(&user_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Activity-day query failed: {error}")))?
        .flatten();
        let most_active_day_of_week = match most_active_day {
            Some(0) => "Sunday",
            Some(1) => "Monday",
            Some(2) => "Tuesday",
            Some(3) => "Wednesday",
            Some(4) => "Thursday",
            Some(5) => "Friday",
            Some(6) => "Saturday",
            _ => "Unknown",
        }
        .to_string();

        let total_study_time: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(duration), 0)::bigint
             FROM study_sessions
             WHERE user_id = $1 AND is_valid = true AND end_time IS NOT NULL",
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Study-time query failed: {error}")))?;
        let average_session_length: Option<f64> = sqlx::query_scalar(
            "SELECT AVG(duration)::double precision
             FROM study_sessions
             WHERE user_id = $1 AND is_valid = true AND end_time IS NOT NULL",
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Session-length query failed: {error}")))?;

        let (average_score, pass_rate): (Option<f64>, Option<f64>) = sqlx::query_as(
            "SELECT AVG(percentage)::double precision,
                    AVG(CASE WHEN is_passed THEN 100.0 ELSE 0.0 END)::double precision
             FROM quiz_attempts
             WHERE user_id = $1 AND completed_at IS NOT NULL",
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Assessment metrics query failed: {error}")))?;
        let average_score = average_score.unwrap_or_default() as f32;
        let pass_rate = pass_rate.unwrap_or_default() as f32;

        #[derive(sqlx::FromRow)]
        struct TopicScore {
            topic: String,
            score: f64,
        }
        let topic_scores = sqlx::query_as::<_, TopicScore>(
            "SELECT t.name AS topic, AVG(qa.percentage)::double precision AS score
             FROM quiz_attempts qa
             JOIN quizzes q ON q.id = qa.quiz_id
             JOIN topics t ON t.id = q.topic_id
             WHERE qa.user_id = $1 AND qa.completed_at IS NOT NULL
             GROUP BY t.name
             ORDER BY score DESC, t.name",
        )
        .bind(&user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Topic metrics query failed: {error}")))?;
        let strength_areas: Vec<String> = topic_scores
            .iter()
            .filter(|topic| topic.score >= 80.0)
            .take(3)
            .map(|topic| topic.topic.clone())
            .collect();
        let mut weakness_areas: Vec<String> = topic_scores
            .iter()
            .filter(|topic| topic.score < 70.0)
            .map(|topic| topic.topic.clone())
            .collect();
        weakness_areas.reverse();
        weakness_areas.truncate(3);

        #[derive(sqlx::FromRow)]
        struct ProgressMetric {
            date: String,
            value: f64,
            metadata: String,
        }
        let progress_metrics = sqlx::query_as::<_, ProgressMetric>(
            "SELECT TO_CHAR(qa.completed_at, 'YYYY-MM-DD') AS date,
                    qa.percentage::double precision AS value,
                    COALESCE(t.name, '') AS metadata
             FROM quiz_attempts qa
             JOIN quizzes q ON q.id = qa.quiz_id
             LEFT JOIN topics t ON t.id = q.topic_id
             WHERE qa.user_id = $1 AND qa.completed_at IS NOT NULL
             ORDER BY qa.completed_at DESC
             LIMIT 10",
        )
        .bind(&user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Progress trend query failed: {error}")))?;
        let course_progress_metrics = sqlx::query_as::<_, ProgressMetric>(
            "SELECT TO_CHAR(updated_at, 'YYYY-MM-DD') AS date,
                    AVG(progress_percentage)::double precision AS value,
                    '' AS metadata
             FROM progress
             WHERE user_id = $1
             GROUP BY updated_at::date
             ORDER BY updated_at::date",
        )
        .bind(&user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| {
            Status::internal(format!("Course progress trend query failed: {error}"))
        })?;
        let recent_scores: Vec<f64> = progress_metrics
            .iter()
            .take(5)
            .map(|metric| metric.value)
            .collect();
        let previous_scores: Vec<f64> = progress_metrics
            .iter()
            .skip(5)
            .take(5)
            .map(|metric| metric.value)
            .collect();
        let improvement_rate = if previous_scores.is_empty() {
            0.0
        } else {
            recent_scores.iter().sum::<f64>() / recent_scores.len() as f64
                - previous_scores.iter().sum::<f64>() / previous_scores.len() as f64
        } as f32;

        let activity_dates: Vec<NaiveDate> = sqlx::query_scalar(
            "SELECT activity_date
             FROM (
                 SELECT DISTINCT start_time::date AS activity_date
                 FROM study_sessions
                 WHERE user_id = $1 AND is_valid = true AND end_time IS NOT NULL
                 UNION
                 SELECT DISTINCT accessed_at::date AS activity_date
                 FROM unit_accesses
                 WHERE user_id = $1
             ) AS activity_days
             ORDER BY activity_date",
        )
        .bind(&user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Study streak query failed: {error}")))?;
        let mut longest_streak = 0;
        let mut current_run = 0;
        let mut previous_day: Option<NaiveDate> = None;
        for day in activity_dates {
            current_run = if previous_day.and_then(|date| date.succ_opt()) == Some(day) {
                current_run + 1
            } else {
                1
            };
            longest_streak = longest_streak.max(current_run);
            previous_day = Some(day);
        }

        let engagement_service = crate::services::engagement_service::EngagementService::new(self.pool.clone());
        let engagement_req = Request::new(crate::analytics_proto::GetEngagementMetricsRequest {
            user_id: user_id.clone(),
        });
        
        let engagement = engagement_service
            .get_engagement_metrics(engagement_req)
            .await?
            .into_inner();
        let engagement_metrics = Some(crate::analytics_proto::EngagementMetrics {
            user_id: user_id.clone(),
            daily_active_streak: engagement.daily_streak,
            weekly_active_streak: engagement.weekly_streak,
            last_activity_date: last_activity_date
                .map(|date| date.to_string())
                .unwrap_or_default(),
            session_count: engagement.activity_frequency,
            average_session_duration: if engagement.activity_frequency > 0 {
                (engagement.time_spent / engagement.activity_frequency as f32).round() as i32
            } else {
                0
            },
            most_active_time_of_day,
            most_active_day_of_week,
        });

        let user_learning_summary = Some(crate::analytics_proto::UserLearningSummary {
            total_study_time: total_study_time.clamp(0, i32::MAX as i64) as i32,
            average_session_length: average_session_length.unwrap_or_default() as f32,
            average_score,
            current_streak: engagement.daily_streak,
            longest_streak,
            strongest_subjects: strength_areas.clone(),
            weakest_subjects: weakness_areas.clone(),
        });
        let performance_metrics = Some(crate::analytics_proto::PerformanceMetrics {
            average_assessment_score: average_score,
            pass_rate,
            weakness_areas,
            strength_areas,
            improvement_rate,
        });
        let progress_trends = progress_metrics
            .into_iter()
            .map(|metric| crate::analytics_proto::ProgressTrend {
                date: metric.date,
                value: metric.value,
                r#type: "assessment_score".to_string(),
                metadata: metric.metadata,
            })
            .collect();
        let course_progress_trends = course_progress_metrics
            .into_iter()
            .map(|metric| crate::analytics_proto::ProgressTrend {
                date: metric.date,
                value: metric.value,
                r#type: "course_progress".to_string(),
                metadata: metric.metadata,
            })
            .collect();

        Ok(Response::new(GetDetailedLearningAnalyticsResponse {
            user_id,
            user_learning_summary,
            goal_analytics,
            course_stats,
            path_stats,
            engagement_metrics,
            performance_metrics,
            progress_trends,
            course_progress_trends,
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

        let progress = crate::modules::analytics::progress_tracking::calculate_course_progress(
            &self.pool,
            &user_id,
            &course_id,
        )
        .await
        .map_err(|error| {
            Status::internal(format!("DB error calculating course progress: {error}"))
        })?;

        Ok(Response::new(progress))
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
        let user_id = req.user_id;
        if user_id.is_empty() {
            return Err(Status::invalid_argument("user_id cannot be empty"));
        }

        let features = crate::modules::analytics::core::feature_extraction::extract_user_features(
            user_id.clone(),
            &self.pool,
        )
        .await
        .map_err(|error| Status::internal(format!("Failed to extract features: {error}")))?;

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
