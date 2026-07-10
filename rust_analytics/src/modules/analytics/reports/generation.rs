use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct GeneratedAnalytics {
    pub user_id: String,
    pub assessment_id: Option<String>,
    pub generated_at: String,
    pub summary: AnalyticsSummary,
    pub detailed_metrics: DetailedMetrics,
    pub recommendations: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalyticsSummary {
    pub overall_performance: f64,
    pub total_study_hours: f64,
    pub completion_rate: f64,
    pub average_score: f64,
    pub active_days: i32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetailedMetrics {
    pub quiz_performance: HashMap<String, f64>,
    pub topic_mastery: HashMap<String, f64>,
    pub learning_velocity: f64,
    pub consistency_score: f64,
    pub improvement_trend: String,
}

/// Generate comprehensive analytics report for a user
/// Production implementation aggregating multiple data sources
pub async fn generate_analytics(
    user_id: &str,
    assessment_id: Option<&str>,
    pool: &Pool<Postgres>,
) -> Result<GeneratedAnalytics, String> {
    // Generate timestamp
    let generated_at = chrono::Utc::now().to_rfc3339();

    // Fetch summary metrics
    let summary = generate_summary_metrics(user_id, pool).await?;

    // Fetch detailed metrics
    let detailed = generate_detailed_metrics(user_id, pool).await?;

    // Generate personalized recommendations
    let recommendations =
        generate_recommendations_based_on_analytics(user_id, &summary, &detailed, pool).await?;

    Ok(GeneratedAnalytics {
        user_id: user_id.to_string(),
        assessment_id: assessment_id.map(|s| s.to_string()),
        generated_at,
        summary,
        detailed_metrics: detailed,
        recommendations,
    })
}

/// Generate summary metrics
async fn generate_summary_metrics(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<AnalyticsSummary, String> {
    // Query user learning analytics
    let analytics = sqlx::query!(
        r#"
        SELECT 
            "totalStudyTime" as "total_study_time!: i32",
            "averageScore" as "average_score!: f64",
            "completionRate" as "completion_rate!: f64",
            streak_days as "current_streak!: i32"
        FROM user_learning_analytics
        WHERE "userId" = $1
        "#,
        user_id
    )
    .fetch_optional(pool)
    .await
    .map_err(|e| format!("Failed to fetch analytics: {}", e))?;

    // Query completed paths for completion rate
    let completion_stats = sqlx::query!(
        r#"
        SELECT 
            COUNT(*)::int as "total!",
            COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as "completed!"
        FROM learning_path_progress
        WHERE user_id = $1
        "#,
        user_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to fetch completion stats: {}", e))?;

    let completion_rate = if completion_stats.total > 0 {
        completion_stats.completed as f64 / completion_stats.total as f64
    } else {
        0.0
    };

    // Calculate overall performance (composite score)
    let avg_score = analytics.as_ref().map(|a| a.average_score).unwrap_or(0.0);
    let overall = (avg_score / 100.0 * 0.6 + completion_rate * 0.4).min(1.0);

    Ok(AnalyticsSummary {
        overall_performance: overall,
        total_study_hours: analytics
            .as_ref()
            .map(|a| a.total_study_time as f64 / 60.0)
            .unwrap_or(0.0),
        completion_rate,
        average_score: avg_score,
        active_days: analytics.as_ref().map(|a| a.current_streak).unwrap_or(0),
    })
}

/// Generate detailed metrics
async fn generate_detailed_metrics(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<DetailedMetrics, String> {
    // Quiz performance by type/category
    let quiz_perf = calculate_quiz_performance_by_category(user_id, pool).await?;

    // Topic mastery levels
    let topic_mastery = calculate_topic_mastery_levels(user_id, pool).await?;

    // Learning velocity
    let velocity = calculate_learning_velocity_metric(user_id, pool).await?;

    // Consistency score
    let consistency = calculate_consistency_metric(user_id, pool).await?;

    // Improvement trend
    let trend = determine_improvement_trend(user_id, pool).await?;

    Ok(DetailedMetrics {
        quiz_performance: quiz_perf,
        topic_mastery,
        learning_velocity: velocity,
        consistency_score: consistency,
        improvement_trend: trend,
    })
}

/// Calculate quiz performance by category
async fn calculate_quiz_performance_by_category(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<HashMap<String, f64>, String> {
    // Query topics from questions via quizzes
    let quiz_data = sqlx::query!(
        r#"
        WITH topic_scores AS (
            SELECT 
                UNNEST(q.tags) as category,
                qa.percentage
            FROM quiz_attempts qa
            JOIN quizzes qz ON qa.quiz_id = qz.id
            JOIN quiz_questions qq ON qz.id = qq.quiz_id
            JOIN questions q ON qq.question_id = q.id
            WHERE qa.user_id = $1
            AND qa.completed_at IS NOT NULL
            AND array_length(q.tags, 1) > 0
        )
        SELECT 
            category,
            AVG(percentage)::float8 as "avg_score!"
        FROM topic_scores
        GROUP BY category
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch quiz performance: {}", e))?;

    let mut performance: HashMap<String, f64> = HashMap::new();
    for row in &quiz_data {
        if let Some(category) = &row.category {
            performance.insert(category.clone(), row.avg_score / 100.0);
        }
    }

    Ok(performance)
}

/// Calculate topic mastery levels
async fn calculate_topic_mastery_levels(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<HashMap<String, f64>, String> {
    // Query user skill states (BKT model)
    let skill_states = sqlx::query!(
        r#"
        SELECT 
            skill_id,
            p_known
        FROM user_skill_states
        WHERE user_id = $1
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch skill states: {}", e))?;

    let mut mastery: HashMap<String, f64> = HashMap::new();
    for record in skill_states {
        mastery.insert(record.skill_id, record.p_known);
    }

    Ok(mastery)
}

/// Calculate learning velocity metric
async fn calculate_learning_velocity_metric(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<f64, String> {
    let paths = sqlx::query!(
        r#"
        SELECT 
            EXTRACT(EPOCH FROM (completed_at - started_at))::float / 3600.0 as "actual_hours",
            estimated_hours
        FROM learning_path_progress lpp
        JOIN learning_paths lp ON lpp.learning_path_id = lp.id
        WHERE lpp.user_id = $1
        AND lpp.completed_at IS NOT NULL
        AND lp.estimated_hours IS NOT NULL
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch velocity data: {}", e))?;

    if paths.is_empty() {
        return Ok(1.0);
    }

    let mut total_velocity = 0.0;
    let mut count = 0;
    for record in &paths {
        if let (Some(actual), Some(expected)) = (record.actual_hours, record.estimated_hours) {
            if actual > 0.0 {
                total_velocity += (expected as f64) / actual;
                count += 1;
            }
        }
    }

    if count > 0 {
        Ok((total_velocity / count as f64).min(3.0))
    } else {
        Ok(1.0)
    }
}

/// Calculate consistency metric
async fn calculate_consistency_metric(user_id: &str, pool: &Pool<Postgres>) -> Result<f64, String> {
    let activity_days = sqlx::query_scalar!(
        r#"
        SELECT COUNT(DISTINCT DATE(created_at))::int as "count!"
        FROM user_activities
        WHERE user_id = $1
        AND created_at >= NOW() - INTERVAL '30 days'
        "#,
        user_id
    )
    .fetch_one(pool)
    .await
    .map_err(|e| format!("Failed to fetch activity days: {}", e))?;

    Ok((activity_days as f64 / 30.0).min(1.0))
}

/// Determine improvement trend
async fn determine_improvement_trend(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<String, String> {
    let scores: Vec<f64> = sqlx::query_scalar!(
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
    .map_err(|e| format!("Failed to fetch scores: {}", e))?;

    if scores.len() < 3 {
        return Ok("insufficient_data".to_string());
    }

    // Simple moving average comparison
    let recent_avg: f64 = scores.iter().take(5).sum::<f64>() / (5_f64).min(scores.len() as f64);
    let older_avg: f64 = scores.iter().skip(5).sum::<f64>() / (scores.len() - 5).max(1) as f64;

    let diff = recent_avg - older_avg;

    if diff > 5.0 {
        Ok("improving".to_string())
    } else if diff < -5.0 {
        Ok("declining".to_string())
    } else {
        Ok("stable".to_string())
    }
}

/// Generate personalized recommendations based on analytics
async fn generate_recommendations_based_on_analytics(
    _user_id: &str,
    summary: &AnalyticsSummary,
    detailed: &DetailedMetrics,
    _pool: &Pool<Postgres>,
) -> Result<Vec<String>, String> {
    let mut recommendations = Vec::new();

    // Recommendation based on average score
    if summary.average_score < 70.0 {
        recommendations.push(
            "Focus on fundamental concepts - your scores suggest reviewing basics".to_string(),
        );
    } else if summary.average_score > 85.0 {
        recommendations.push(
            "Excellent performance! Consider advancing to more challenging materials".to_string(),
        );
    }

    // Recommendation based on consistency
    if detailed.consistency_score < 0.5 {
        recommendations
            .push("Try to study more regularly - consistency improves retention".to_string());
    } else if detailed.consistency_score > 0.8 {
        recommendations.push("Great study habits! Your consistency is paying off".to_string());
    }

    // Recommendation based on completion rate
    if summary.completion_rate < 0.3 {
        recommendations
            .push("Focus on completing started courses before starting new ones".to_string());
    }

    // Recommendation based on trend
    match detailed.improvement_trend.as_str() {
        "improving" => recommendations
            .push("Keep up the momentum! Your scores are trending upward".to_string()),
        "declining" => recommendations
            .push("Consider reviewing recent topics - your scores are declining".to_string()),
        _ => {}
    }

    // Find weak topics
    let weak_topics: Vec<String> = detailed
        .topic_mastery
        .iter()
        .filter(|(_, &score)| score < 0.6)
        .map(|(topic, _)| topic.clone())
        .collect();

    if !weak_topics.is_empty() {
        recommendations.push(format!("Focus on these topics: {}", weak_topics.join(", ")));
    }

    Ok(recommendations)
}
