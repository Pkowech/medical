use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use std::collections::HashMap;

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct PerformanceAnalytics {
    pub user_id: String,
    pub overall_score: f64,
    pub quiz_performance: QuizPerformance,
    pub learning_velocity: f64,
    pub consistency_score: f64,
    pub topic_mastery: HashMap<String, f64>,
    pub recent_trend: String,
    pub time_management: TimeManagement,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct QuizPerformance {
    pub total_attempts: i32,
    pub average_score: f64,
    pub pass_rate: f64,
    pub improvement_rate: f64,
}

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct TimeManagement {
    pub avg_session_duration_minutes: f64,
    pub total_study_time_hours: f64,
    pub consistency_days: i32,
}

/// Get comprehensive performance analytics for a user
/// Production implementation with database queries and statistical analysis
pub async fn get_performance_analytics(
    user_id: &str,
    _assessment_id: Option<&str>,
    pool: &Pool<Postgres>,
) -> Result<PerformanceAnalytics, String> {
    // Fetch quiz performance data
    let quiz_perf = calculate_quiz_performance(user_id, pool).await?;

    // Calculate learning velocity (completion rate vs expected)
    let velocity = calculate_learning_velocity(user_id, pool).await?;

    // Calculate consistency score (regularity of study sessions)
    let consistency = calculate_consistency_score(user_id, pool).await?;

    // Calculate topic-level mastery
    let topic_mastery = calculate_topic_mastery(user_id, pool).await?;

    // Determine recent performance trend
    let trend = determine_performance_trend(user_id, pool).await?;

    // Calculate time management metrics
    let time_mgmt = calculate_time_management(user_id, pool).await?;

    // Calculate overall score (weighted average)
    let overall_score = calculate_overall_score(&quiz_perf, velocity, consistency);

    Ok(PerformanceAnalytics {
        user_id: user_id.to_string(),
        overall_score,
        quiz_performance: quiz_perf,
        learning_velocity: velocity,
        consistency_score: consistency,
        topic_mastery,
        recent_trend: trend,
        time_management: time_mgmt,
    })
}

/// Calculate quiz performance metrics
async fn calculate_quiz_performance(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<QuizPerformance, String> {
    let quiz_stats = sqlx::query!(
        r#"
        SELECT 
            COUNT(*)::int as "total!",
            AVG(score) as avg_score,
            AVG(percentage) as avg_percentage,
            COALESCE(SUM(CASE WHEN is_passed THEN 1 ELSE 0 END), 0)::int as "passed!"
        FROM quiz_attempts
        WHERE user_id = $1
        AND completed_at IS NOT NULL
        "#,
        user_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e: sqlx::Error| format!("Failed to fetch quiz stats: {}", e))?;

    let _avg_score = quiz_stats.avg_score.unwrap_or_default();
    let pass_rate: f64 = if quiz_stats.total > 0 {
        quiz_stats.passed as f64 / quiz_stats.total as f64
    } else {
        0.0
    };

    // Calculate improvement rate (compare first 5 vs last 5 attempts)
    let improvement = calculate_improvement_rate(user_id, pool).await?;

    Ok(QuizPerformance {
        total_attempts: quiz_stats.total,
        average_score: quiz_stats.avg_percentage.unwrap_or(0.0),
        pass_rate,
        improvement_rate: improvement,
    })
}

/// Calculate improvement rate by comparing recent vs early performance
async fn calculate_improvement_rate(user_id: &str, pool: &Pool<Postgres>) -> Result<f64, String> {
    let early_scores: Vec<Option<f64>> = sqlx::query_scalar!(
        r#"
        SELECT percentage as "percentage: Option<f64>"
        FROM quiz_attempts
        WHERE user_id = $1
        AND completed_at IS NOT NULL
        ORDER BY completed_at ASC
        LIMIT 5
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch early scores: {}", e))?;

    let recent_scores: Vec<Option<f64>> = sqlx::query_scalar!(
        r#"
        SELECT percentage as "percentage: Option<f64>"
        FROM quiz_attempts
        WHERE user_id = $1
        AND completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 5
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch recent scores: {}", e))?;

    // Filter out None values
    let early_scores: Vec<f64> = early_scores.into_iter().filter_map(|x| x).collect();
    let recent_scores: Vec<f64> = recent_scores.into_iter().filter_map(|x| x).collect();

    if early_scores.is_empty() || recent_scores.is_empty() {
        return Ok(0.0);
    }

    let early_avg: f64 = early_scores.iter().sum::<f64>() / early_scores.len() as f64;
    let recent_avg: f64 = recent_scores.iter().sum::<f64>() / recent_scores.len() as f64;

    // Return percentage improvement
    Ok(((recent_avg - early_avg) / early_avg.max(1.0)) * 100.0)
}

/// Calculate learning velocity (actual vs expected completion rate)
async fn calculate_learning_velocity(user_id: &str, pool: &Pool<Postgres>) -> Result<f64, String> {
    let path_progress = sqlx::query!(
        r#"
        SELECT 
            lpp.learning_path_id,
            lpp.started_at,
            lpp.completed_at,
            lp.estimated_duration_weeks
        FROM learning_path_progress lpp
        JOIN learning_paths lp ON lpp.learning_path_id = lp.id
        WHERE lpp.user_id = $1
        AND lpp.completed_at IS NOT NULL
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch path progress: {}", e))?;

    if path_progress.is_empty() {
        return Ok(1.0); // Neutral velocity
    }

    let mut total_velocity = 0.0;
    let mut count = 0;

    for record in path_progress {
        if let (Some(completed), Some(expected_weeks)) =
            (record.completed_at, record.estimated_duration_weeks)
        {
            let actual_days = (completed - record.started_at).num_days() as f64;
            let expected_days = expected_weeks as f64 * 7.0;

            if actual_days > 0.0 {
                // Velocity = expected / actual (>1 means faster than expected)
                let velocity = expected_days / actual_days;
                total_velocity += velocity;
                count += 1;
            }
        }
    }

    if count > 0 {
        Ok((total_velocity / count as f64).min(3.0)) // Cap at 3x
    } else {
        Ok(1.0)
    }
}

/// Calculate consistency score based on study regularity
async fn calculate_consistency_score(user_id: &str, pool: &Pool<Postgres>) -> Result<f64, String> {
    // Get study activity dates for last 30 days
    let activities: Vec<chrono::NaiveDate> = sqlx::sqlx_macros::expand_query!(
        scalar = _,
        source = r#"
        SELECT DATE(created_at)
        FROM user_activities
        WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY DATE(created_at)
        ORDER BY DATE(created_at)
        "#,
        args = [user_id]
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch activities: {}", e))?
    .into_iter()
    .filter_map(|d| d)
    .collect();

    if activities.is_empty() {
        return Ok(0.0);
    }

    // Calculate streak and gaps
    let active_days = activities.len() as f64;
    let days_in_period = 30.0;

    // Base score from frequency
    let frequency_score = (active_days / days_in_period).min(1.0);

    // Bonus for consecutive days (streaks)
    let streak_bonus = calculate_streak_bonus(&activities);

    // Final score (0-1)
    Ok((frequency_score * 0.7 + streak_bonus * 0.3).min(1.0))
}

/// Calculate bonus for study streaks
fn calculate_streak_bonus(dates: &[chrono::NaiveDate]) -> f64 {
    if dates.len() < 2 {
        return 0.0;
    }

    let mut max_streak = 1;
    let mut current_streak = 1;

    for i in 1..dates.len() {
        let diff = (dates[i] - dates[i - 1]).num_days();
        if diff == 1 {
            current_streak += 1;
            max_streak = max_streak.max(current_streak);
        } else {
            current_streak = 1;
        }
    }

    // Normalize to 0-1 (streaks of 7+ days get max score)
    (max_streak as f64 / 7.0).min(1.0)
}

/// Calculate mastery level for each topic/subject
async fn calculate_topic_mastery(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<HashMap<String, f64>, String> {
    // Query quiz attempts with topics/tags from questions table
    let quiz_data = sqlx::query!(
        r#"
        SELECT 
            UNNEST(q.tags) as topic,
            qa.percentage
        FROM quiz_attempts qa
        JOIN quizzes qz ON qa.quiz_id = qz.id
        JOIN quiz_questions qq ON qz.id = qq.quiz_id
        JOIN questions q ON qq.question_id = q.id
        WHERE qa.user_id = $1
        AND qa.completed_at IS NOT NULL
        AND array_length(q.tags, 1) > 0
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch quiz topic data: {}", e))?;

    let mut topic_scores: HashMap<String, Vec<f64>> = HashMap::new();

    for record in quiz_data {
        if let Some(topic) = record.topic {
            topic_scores
                .entry(topic)
                .or_insert_with(Vec::new)
                .push(record.percentage);
        }
    }

    // Calculate average score per topic
    let mut mastery: HashMap<String, f64> = HashMap::new();
    for (topic, scores) in topic_scores {
        let avg = scores.iter().sum::<f64>() / scores.len() as f64;
        mastery.insert(topic, avg / 100.0); // Normalize to 0-1
    }
    Ok(mastery)
}

#[allow(dead_code)]
fn extract_tags(tags_json: &serde_json::Value) -> Vec<String> {
    match tags_json {
        serde_json::Value::Array(arr) => arr
            .iter()
            .filter_map(|v| v.as_str().map(|s| s.to_string()))
            .collect(),
        serde_json::Value::String(s) => s.split(',').map(|t| t.trim().to_string()).collect(),
        _ => Vec::new(),
    }
}

/// Determine recent performance trend
async fn determine_performance_trend(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<String, String> {
    let recent_scores: Vec<f64> = sqlx::query_scalar!(
        r#"
        SELECT percentage as "percentage!"
        FROM quiz_attempts
        WHERE user_id = $1
        AND completed_at IS NOT NULL
        ORDER BY completed_at DESC
        LIMIT 10
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch recent scores: {}", e))?;

    if recent_scores.len() < 3 {
        return Ok("insufficient_data".to_string());
    }

    // Simple linear trend calculation
    let n = recent_scores.len() as f64;
    let x_vals: Vec<f64> = (0..recent_scores.len()).map(|i| i as f64).collect();

    let x_mean = x_vals.iter().sum::<f64>() / n;
    let y_mean = recent_scores.iter().sum::<f64>() / n;

    let numerator: f64 = x_vals
        .iter()
        .zip(recent_scores.iter())
        .map(|(x, y)| (x - x_mean) * (y - y_mean))
        .sum();

    let denominator: f64 = x_vals.iter().map(|x| (x - x_mean).powi(2)).sum();

    let slope = if denominator != 0.0 {
        numerator / denominator
    } else {
        0.0
    };

    // Classify trend
    if slope > 2.0 {
        Ok("strongly_improving".to_string())
    } else if slope > 0.5 {
        Ok("improving".to_string())
    } else if slope < -2.0 {
        Ok("declining".to_string())
    } else if slope < -0.5 {
        Ok("slightly_declining".to_string())
    } else {
        Ok("stable".to_string())
    }
}

/// Calculate time management metrics
async fn calculate_time_management(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<TimeManagement, String> {
    let time_stats = sqlx::query!(
        r#"
        SELECT 
            AVG(time_spent)::float as avg_time,
            SUM(time_spent)::float as total_time,
            COUNT(DISTINCT DATE(started_at))::int as "active_days!"
        FROM quiz_attempts
        WHERE user_id = $1
        AND completed_at IS NOT NULL
        "#,
        user_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to fetch time stats: {}", e))?;

    let total_study_time_minutes = time_stats.total_time.unwrap_or(0.0);
    let total_hours = total_study_time_minutes / 60.0;

    Ok(TimeManagement {
        avg_session_duration_minutes: time_stats.avg_time.unwrap_or(0.0),
        total_study_time_hours: total_hours,
        consistency_days: time_stats.active_days,
    })
}
/// Calculate overall performance score
fn calculate_overall_score(quiz_perf: &QuizPerformance, velocity: f64, consistency: f64) -> f64 {
    // Weighted average of key metrics
    let quiz_score = quiz_perf.average_score / 100.0;
    let velocity_score = (velocity / 2.0).min(1.0); // Normalize velocity

    (quiz_score * 0.50 + consistency * 0.25 + velocity_score * 0.25).min(1.0)
}
