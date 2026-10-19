use sqlx::{Pool, Postgres, Row};
use tonic::{Request, Response, Status};
use std::sync::Arc;
use std::collections::HashMap;
use crate::analytics_proto::{
    GetEngagementMetricsRequest, GetEngagementMetricsResponse, GetStudyPatternsRequest,
    GetStudyPatternsResponse, PreferredStudyTimes, QuizAttemptHistoryRequest,
    QuizAttemptHistoryResponse, QuizAttemptHistoryItem, StudyDurationMetrics,
};

pub struct EngagementService {
    pool: Pool<Postgres>,
}

impl EngagementService {
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self { pool }
    }

    fn validate_user_id(user_id: &str) -> Result<(), Status> {
        if user_id.is_empty() {
            return Err(Status::invalid_argument("user_id cannot be empty"));
        }
        Ok(())
    }

    pub async fn get_engagement_metrics(
        &self,
        request: Request<GetEngagementMetricsRequest>,
    ) -> Result<Response<GetEngagementMetricsResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id;

        Self::validate_user_id(&user_id)?;

        let repo = crate::infrastructure::database::repositories::PostgresActivityRepository::new(Arc::new(self.pool.clone()));
        let use_case = crate::application::use_cases::engagement::GetEngagementMetricsUseCase::new(std::sync::Arc::new(repo));

        let app_req = crate::application::dtos::engagement::GetEngagementMetricsRequest { user_id: user_id.clone() };
        let result = use_case
            .execute(app_req)
            .await
            .map_err(|e| Status::internal(format!("Engagement metrics failed: {}", e)))?;

        let total_study_time_minutes: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(duration), 0)::bigint
             FROM study_sessions
             WHERE user_id = $1 AND is_valid = true AND end_time IS NOT NULL",
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Total study-time query failed: {error}")))?;

        let weekly_metrics: (i64, i64) = sqlx::query_as(
            "SELECT COALESCE(SUM(duration), 0)::bigint,
                    COUNT(DISTINCT start_time::date)::bigint
             FROM study_sessions
             WHERE user_id = $1
               AND is_valid = true
               AND end_time IS NOT NULL
               AND start_time >= date_trunc('day', NOW()) - INTERVAL '6 days'",
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Weekly study metrics query failed: {error}")))?;

        Ok(Response::new(GetEngagementMetricsResponse {
            time_spent: result.time_spent,
            completion_rate: result.completion_rate,
            activity_frequency: result.activity_frequency,
            daily_streak: result.daily_streak,
            weekly_streak: result.weekly_streak,
            total_study_time_minutes: total_study_time_minutes
                .clamp(0, i32::MAX as i64) as i32,
            weekly_study_minutes: weekly_metrics.0.clamp(0, i32::MAX as i64) as i32,
            active_study_days_this_week: weekly_metrics.1.clamp(0, i32::MAX as i64) as i32,
        }))
    }

    pub async fn get_study_patterns(
        &self,
        request: Request<GetStudyPatternsRequest>,
    ) -> Result<Response<GetStudyPatternsResponse>, Status> {
        let user_id = request.into_inner().user_id;
        Self::validate_user_id(&user_id)?;

        let sessions = sqlx::query(
            "SELECT CASE
                        WHEN EXTRACT(HOUR FROM start_time) >= 5 AND EXTRACT(HOUR FROM start_time) < 12 THEN 'morning'
                        WHEN EXTRACT(HOUR FROM start_time) >= 12 AND EXTRACT(HOUR FROM start_time) < 17 THEN 'afternoon'
                        WHEN EXTRACT(HOUR FROM start_time) >= 17 AND EXTRACT(HOUR FROM start_time) < 21 THEN 'evening'
                        ELSE 'night'
                    END AS period,
                    COUNT(*)::bigint AS session_count,
                    COALESCE(SUM(COALESCE(duration, FLOOR(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)::int)), 0)::bigint AS duration_minutes
             FROM study_sessions
             WHERE user_id = $1
               AND is_valid = TRUE
               AND end_time IS NOT NULL
             GROUP BY period",
        )
        .bind(&user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Study-pattern query failed: {error}")))?;

        let mut time_distribution = HashMap::from([
            ("morning".to_string(), 0.0),
            ("afternoon".to_string(), 0.0),
            ("evening".to_string(), 0.0),
            ("night".to_string(), 0.0),
        ]);
        let mut session_counts = HashMap::new();
        for row in sessions {
            let period: String = row
                .try_get("period")
                .map_err(|error| Status::internal(format!("Invalid study period: {error}")))?;
            let session_count: i64 = row.try_get("session_count").map_err(|error| {
                Status::internal(format!("Invalid study session count: {error}"))
            })?;
            let duration_minutes: i64 = row.try_get("duration_minutes").map_err(|error| {
                Status::internal(format!("Invalid study duration total: {error}"))
            })?;
            time_distribution.insert(period.clone(), duration_minutes as f64);
            session_counts.insert(period, session_count);
        }

        let duration = sqlx::query(
            "SELECT COALESCE(AVG(session_minutes), 0)::double precision AS average_duration,
                    COALESCE(MAX(session_minutes), 0)::double precision AS longest_session,
                    COALESCE(MIN(session_minutes), 0)::double precision AS shortest_session
             FROM (
                 SELECT COALESCE(duration, FLOOR(EXTRACT(EPOCH FROM (end_time - start_time)) / 60)::int) AS session_minutes
                 FROM study_sessions
                 WHERE user_id = $1
                   AND is_valid = TRUE
                   AND end_time IS NOT NULL
             ) completed_sessions",
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Study-duration query failed: {error}")))?;
        let average_duration: f64 = duration
            .try_get("average_duration")
            .map_err(|error| Status::internal(format!("Invalid average duration: {error}")))?;
        let longest_session: f64 = duration
            .try_get("longest_session")
            .map_err(|error| Status::internal(format!("Invalid longest session: {error}")))?;
        let shortest_session: f64 = duration
            .try_get("shortest_session")
            .map_err(|error| Status::internal(format!("Invalid shortest session: {error}")))?;

        let active_days: i64 = sqlx::query_scalar(
            "SELECT COUNT(DISTINCT start_time::date)::bigint
             FROM study_sessions
             WHERE user_id = $1
               AND is_valid = TRUE
               AND end_time IS NOT NULL
               AND start_time >= date_trunc('day', NOW()) - INTERVAL '29 days'
               AND start_time < NOW()",
        )
        .bind(&user_id)
        .fetch_one(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Study-consistency query failed: {error}")))?;

        let topic_scores = sqlx::query(
            "SELECT t.name AS topic,
                    AVG(COALESCE(qa.percentage, qa.score))::double precision AS score
             FROM quiz_attempts qa
             JOIN quizzes q ON q.id = qa.quiz_id
             JOIN topics t ON t.id = q.topic_id
             WHERE qa.user_id = $1
               AND qa.completed_at IS NOT NULL
               AND q.topic_id IS NOT NULL
             GROUP BY t.name
             ORDER BY t.name",
        )
        .bind(&user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Topic-performance query failed: {error}")))?;
        let mut performance_by_topic = HashMap::with_capacity(topic_scores.len());
        for row in topic_scores {
            let topic: String = row
                .try_get("topic")
                .map_err(|error| Status::internal(format!("Invalid topic name: {error}")))?;
            let score: f64 = row
                .try_get("score")
                .map_err(|error| Status::internal(format!("Invalid topic score: {error}")))?;
            performance_by_topic.insert(topic, score);
        }

        let morning = *session_counts.get("morning").unwrap_or(&0);
        let afternoon = *session_counts.get("afternoon").unwrap_or(&0);
        let evening = *session_counts.get("evening").unwrap_or(&0);
        let night = *session_counts.get("night").unwrap_or(&0);
        let mut patterns = Vec::new();
        let dominant_period = [
            ("Morning learner", morning),
            ("Afternoon learner", afternoon),
            ("Evening learner", evening),
            ("Night learner", night),
        ]
        .into_iter()
        .max_by_key(|(_, count)| *count);
        if let Some((pattern, _)) = dominant_period.filter(|(_, count)| *count > 0) {
            patterns.push(pattern.to_string());
        }
        if active_days >= 21 {
            patterns.push("Consistent learner".to_string());
        }

        let consistency = i32::try_from(active_days)
            .map_err(|error| Status::internal(format!("Active-day count overflow: {error}")))?;
        let preferred_study_times = PreferredStudyTimes {
            morning: i32::try_from(morning)
                .map_err(|error| Status::internal(format!("Morning count overflow: {error}")))?,
            afternoon: i32::try_from(afternoon).map_err(|error| {
                Status::internal(format!("Afternoon count overflow: {error}"))
            })?,
            evening: i32::try_from(evening)
                .map_err(|error| Status::internal(format!("Evening count overflow: {error}")))?,
            night: i32::try_from(night)
                .map_err(|error| Status::internal(format!("Night count overflow: {error}")))?,
        };

        Ok(Response::new(GetStudyPatternsResponse {
            user_id,
            patterns,
            consistency,
            time_distribution,
            study_duration: Some(StudyDurationMetrics {
                average_duration,
                longest_session,
                shortest_session,
            }),
            preferred_study_times: Some(preferred_study_times),
            performance_by_topic,
            consistency_score: (active_days as f64 / 30.0).min(1.0),
        }))
    }

    pub async fn get_quiz_attempt_history(
        &self, 
        request: Request<QuizAttemptHistoryRequest>
    ) -> Result<Response<QuizAttemptHistoryResponse>, Status> {
        let r = request.into_inner();
        let limit = if r.limit <= 0 { None } else { Some(r.limit) };
        let offset = if r.offset <= 0 { None } else { Some(r.offset) };

        let (attempts, stats, recent_improvement) =
            crate::modules::analytics::engagement::quiz_history::get_quiz_attempt_history(
                &r.user_id,
                limit,
                offset,
                true,
                &self.pool,
            )
            .await
            .map_err(|error| Status::internal(format!("Quiz history failed: {error}")))?;
        let proto_attempts = attempts
            .into_iter()
            .map(|attempt| QuizAttemptHistoryItem {
                attempt_id: attempt.attempt_id,
                quiz_id: attempt.quiz_id,
                score: attempt.score,
                date: attempt
                    .date
                    .map(|date| date.and_utc().to_rfc3339())
                    .unwrap_or_default(),
                total_questions: attempt.total_questions,
                correct_answers: attempt.correct_answers,
                time_taken_seconds: attempt.time_taken_seconds,
                quiz_title: attempt.quiz_title,
                unit_id: attempt.unit_id,
                unit_title: attempt.unit_title,
            })
            .collect();
        Ok(Response::new(QuizAttemptHistoryResponse {
            attempts: proto_attempts,
            total_attempts: stats.total_attempts.min(i32::MAX as i64) as i32,
            average_score: stats.average_score.unwrap_or(0.0),
            best_score: stats.best_score.unwrap_or(0.0),
            total_time_spent_seconds: stats.total_time_spent_seconds.unwrap_or(0),
            recent_improvement,
        }))
    }

    pub async fn batch_track_events(
        &self,
        request: Request<crate::analytics_proto::BatchEventRequest>,
    ) -> Result<Response<crate::analytics_proto::BatchEventResponse>, Status> {
        let req = request.into_inner();

        let mapped: Vec<crate::modules::analytics::events::EventPayload> = req
            .events
            .into_iter()
            .map(|e| crate::modules::analytics::events::EventPayload {
                event_type: e.event_type,
                data: Some(crate::shared::utils::proto_value_to_json(e.data)), // Assuming shared utility or I need to copy proto_value_to_json
                timestamp: e.timestamp,
                session_id: Some(e.session_id),
                duration: Some(e.duration),
            })
            .collect();

        match crate::modules::analytics::events::store_batch_events(&req.user_id, mapped, &self.pool).await {
            Ok(res) => Ok(Response::new(crate::analytics_proto::BatchEventResponse {
                success: res.success,
                processed: res.processed as i32,
                failed: res.failed as i32,
                message: res.message,
            })),
            Err(e) => Err(Status::internal(format!("batch store failed: {}", e))),
        }
    }
}
