use crate::modules::analytics::core::feature_extraction::LearningHistoryItem;
use sqlx::{Pool, Postgres, Row};
use crate::shared::error::AnalyticsError;
use chrono::{NaiveDate, NaiveDateTime};
use sqlx::PgPool;

pub async fn get_learning_history(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<Vec<LearningHistoryItem>, sqlx::Error> {
    // Combine quiz attempts and material progress into learning history
    let mut history = Vec::new();

    // Get quiz attempts
    let quiz_attempts = sqlx::query_as::<
        _,
        (
            String,
            String,
            Option<f64>,
            Option<i32>,
            chrono::DateTime<chrono::Utc>,
        ),
    >(
        "SELECT q.id, q.course_id, qa.score, qa.time_taken, qa.created_at 
         FROM quiz_attempts qa
         JOIN quizzes q ON qa.quiz_id = q.id
         WHERE qa.user_id = $1
         ORDER BY qa.created_at DESC
         LIMIT 100",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();

    for (quiz_id, course_id, score, time_taken, timestamp) in quiz_attempts {
        history.push(LearningHistoryItem {
            material_id: quiz_id,
            score,
            duration: time_taken,
            category: course_id,
            timestamp,
            difficulty: score.map(|s| (s / 100.0) * 0.5 + 0.25), // Map to 0.25-0.75 range
            engagement: Some(0.8),
            item_type: Some("quiz".to_string()),
            interaction_score: score.map(|s| s / 100.0),
        });
    }

    // Get material progress
    let material_progress =
        sqlx::query_as::<_, (String, i32, String, chrono::DateTime<chrono::Utc>)>(
            "SELECT mp.id, mp.completion_percentage, uc.unit_id, mp.updated_at 
         FROM material_progress mp
         LEFT JOIN unit_completions uc ON mp.unit_id = uc.unit_id
         WHERE mp.user_id = $1
         ORDER BY mp.updated_at DESC
         LIMIT 100",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();

    for (material_id, completion, category, timestamp) in material_progress {
        history.push(LearningHistoryItem {
            material_id,
            score: Some(completion as f64),
            duration: Some(30),
            category,
            timestamp,
            difficulty: Some(0.5),
            engagement: Some(0.7),
            item_type: Some("study".to_string()),
            interaction_score: Some(completion as f64 / 100.0),
        });
    }

    // Get material events (views/downloads/uploads)
    let material_event_rows = sqlx::query(
        "SELECT material_id, event_type, view_count, download_count, last_page, last_occurred_at FROM material_events WHERE user_id = $1 ORDER BY last_occurred_at DESC LIMIT 100",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .unwrap_or_default();
    for row in material_event_rows {
        let material_id: String = row.try_get("material_id").unwrap_or_default();
        let event_type: String = row.try_get("event_type").unwrap_or_default();
        let view_count: i32 = row.try_get("view_count").unwrap_or(0);
        let download_count: i32 = row.try_get("download_count").unwrap_or(0);
        let _last_page: Option<i32> = row.try_get("last_page").ok();
        let ts: chrono::DateTime<chrono::Utc> = row.try_get("last_occurred_at").unwrap_or(chrono::Utc::now());
        let interaction_score = (view_count as f64 * 0.2 + download_count as f64 * 0.8).min(1.0);
        history.push(LearningHistoryItem {
            material_id: material_id.clone(),
            score: None,
            duration: None,
            category: String::new(),
            timestamp: ts,
            difficulty: None,
            engagement: Some(interaction_score),
            item_type: Some(event_type),
            interaction_score: Some(interaction_score),
        });
    }

    // Get xAPI statements and include them
    let xapi_rows = sqlx::query("SELECT id, verb, raw, occurred_at FROM xapi_statements WHERE user_id = $1 ORDER BY occurred_at DESC LIMIT 100")
        .bind(user_id)
        .fetch_all(pool)
        .await
        .unwrap_or_default();
    for row in xapi_rows {
        let verb: String = row.try_get("verb").unwrap_or_else(|_| "unknown".to_string());
        let raw: serde_json::Value = row.try_get("raw").unwrap_or(serde_json::json!({}));
        let occurred_at: chrono::DateTime<chrono::Utc> = row.try_get("occurred_at").unwrap_or(chrono::Utc::now());
        let material_id = raw.get("object").and_then(|o| o.get("id")).and_then(|id| id.as_str()).unwrap_or_default().to_string();
        let interaction_score = if verb.contains("completed") || verb.contains("passed") { 1.0 } else if verb.contains("view") || verb.contains("read") { 0.5 } else { 0.3 };
        history.push(LearningHistoryItem {
            material_id: if material_id.is_empty() { format!("xapi_{}", row.try_get::<String, _>("id").unwrap_or_default()) } else { material_id.clone() },
            score: None,
            duration: raw.get("result").and_then(|r| r.get("duration")).and_then(|d| d.as_str()).and_then(|s| humantime::parse_duration(s).ok()).map(|d| (d.as_secs() / 60) as i32),
            category: String::new(),
            timestamp: occurred_at,
            difficulty: None,
            engagement: Some(interaction_score),
            item_type: Some(verb.clone()),
            interaction_score: Some(interaction_score),
        });
    }

    Ok(history)
}

    // --- Additional DB helpers moved from learning analytics ---

    /// SQLx adapter: fetch study sessions for a user from `learning_goal_progress`.
    /// Returns tuples of (recorded_at, duration_minutes).
    pub async fn get_study_sessions_db(
        pool: &PgPool,
        user_id: &str,
    ) -> Result<Vec<(NaiveDateTime, i32)>, AnalyticsError> {
        if user_id.is_empty() {
            return Err(AnalyticsError::InternalError("Invalid user id".to_string()));
        }

        let query = r#"
            SELECT recorded_at,
                   COALESCE((metadata->>'sessionDuration')::int, 30) AS duration
            FROM learning_goal_progress
            WHERE user_id = $1
            ORDER BY recorded_at DESC
        "#;

        let rows = sqlx::query(query)
            .bind(user_id)
            .fetch_all(pool)
            .await
            .map_err(|e| AnalyticsError::InternalError(e.to_string()))?;

        let mut sessions = Vec::with_capacity(rows.len());
        for row in rows {
            let ts: NaiveDateTime = row
                .try_get("recorded_at")
                .map_err(|e| AnalyticsError::InternalError(e.to_string()))?;
            let duration: i32 = row.try_get("duration").unwrap_or(30);
            sessions.push((ts, duration));
        }

        Ok(sessions)
    }

    pub async fn get_cohort_users_db(
        pool: &PgPool,
        cohort_id: &str,
    ) -> Result<Vec<String>, AnalyticsError> {
        if cohort_id.is_empty() {
            return Ok(Vec::new());
        }

        let query = r#"
            SELECT sgm.user_id
            FROM study_group_members sgm
            JOIN study_groups sg ON sgm.study_group_id = sg.id
            WHERE sg.invite_code = $1
        "#;

        let rows = sqlx::query(query)
            .bind(cohort_id)
            .fetch_all(pool)
            .await
            .map_err(|e| AnalyticsError::InternalError(e.to_string()))?;

        let mut ids = Vec::with_capacity(rows.len());
        for row in rows {
            let id: String = row
                .try_get("user_id")
                .map_err(|e| AnalyticsError::InternalError(e.to_string()))?;
            ids.push(id);
        }

        Ok(ids)
    }

    pub async fn get_progress_data_for_period_db(
        pool: &PgPool,
        user_id: &str,
        start_date: NaiveDateTime,
        end_date: NaiveDateTime,
    ) -> Result<(i32, f32, Vec<(NaiveDate, i32)>), AnalyticsError> {
        if user_id.is_empty() {
            return Err(AnalyticsError::InternalError("Invalid user id".to_string()));
        }

        let total_course_time: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(time_spent),0) FROM course_progress WHERE user_id = $1 AND last_accessed_at BETWEEN $2 AND $3",
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .map_err(|e| AnalyticsError::InternalError(e.to_string()))?;

        let total_path_time: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM(total_time_spent_minutes),0) FROM learning_path_progress WHERE user_id = $1 AND last_activity_date BETWEEN $2 AND $3",
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let total_sessions_time: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM((metadata->>'sessionDuration')::int),0) FROM learning_goal_progress WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3",
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let total_study_time = (total_course_time + total_path_time + total_sessions_time) as i32;

        let avg_score: Option<f32> = sqlx::query_scalar(
            "SELECT AVG(percentage) FROM quiz_attempts WHERE user_id = $1 AND completed_at BETWEEN $2 AND $3",
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .ok();

        let average_score = avg_score.unwrap_or(0.0);

        let daily_rows = sqlx::query(
            "SELECT date(recorded_at) as day, COALESCE(SUM((metadata->>'sessionDuration')::int),0) as total_minutes FROM learning_goal_progress WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3 GROUP BY day ORDER BY day",
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_all(pool)
        .await
        .map_err(|e| AnalyticsError::InternalError(e.to_string()))?;

        let mut daily_stats = Vec::with_capacity(daily_rows.len());
        for row in daily_rows {
            let day: NaiveDate = row
                .try_get("day")
                .map_err(|e| AnalyticsError::InternalError(e.to_string()))?;
            let mins: i32 = row.try_get("total_minutes").unwrap_or(0);
            daily_stats.push((day, mins));
        }

        Ok((total_study_time, average_score, daily_stats))
    }

    pub async fn get_completion_data_for_period_db(
        pool: &PgPool,
        user_id: &str,
        start_date: NaiveDateTime,
        end_date: NaiveDateTime,
    ) -> Result<(i32, i32, i32, Vec<String>), AnalyticsError> {
        if user_id.is_empty() {
            return Err(AnalyticsError::InternalError("Invalid user id".to_string()));
        }

        let courses_completed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM course_progress WHERE user_id = $1 AND status = 'completed' AND last_accessed_at BETWEEN $2 AND $3",
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let paths_completed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM learning_path_progress WHERE user_id = $1 AND status = 'completed' AND last_activity_date BETWEEN $2 AND $3",
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let assessments_passed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM quiz_attempts WHERE user_id = $1 AND percentage >= 50 AND completed_at BETWEEN $2 AND $3",
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        Ok((
            courses_completed as i32,
            paths_completed as i32,
            assessments_passed as i32,
            Vec::new(),
        ))
    }

    pub async fn get_engagement_data_for_period_db(
        pool: &PgPool,
        user_id: &str,
        start_date: NaiveDateTime,
        end_date: NaiveDateTime,
    ) -> Result<(i32, f32, i32), AnalyticsError> {
        if user_id.is_empty() {
            return Err(AnalyticsError::InternalError("Invalid user id".to_string()));
        }

        let sessions_count: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM learning_goal_progress WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3",
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let total_minutes: i64 = sqlx::query_scalar(
            "SELECT COALESCE(SUM((metadata->>'sessionDuration')::int),0) FROM learning_goal_progress WHERE user_id = $1 AND recorded_at BETWEEN $2 AND $3",
        )
        .bind(user_id)
        .bind(start_date)
        .bind(end_date)
        .fetch_one(pool)
        .await
        .unwrap_or(0);

        let avg_session: f32 = if sessions_count > 0 {
            total_minutes as f32 / sessions_count as f32
        } else {
            30.0
        };

        Ok((sessions_count as i32, avg_session, total_minutes as i32))
    }
