use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use crate::observability::metrics as obs_metrics;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StudyRecommendation {
    pub recommendation: String,
    pub priority: String,
    pub estimated_time_hours: i32,
    pub resource_id: Option<String>,
}

pub async fn generate_study_recommendations(
    user_id: &str,
    knowledge_gaps: &[String],
    pool: &Pool<Postgres>,
) -> Result<Vec<StudyRecommendation>, String> {
    if user_id.trim().is_empty() {
        return Err("user_id cannot be empty".to_string());
    }

    let mut gaps: Vec<String> = knowledge_gaps.to_vec();

    if gaps.is_empty() {
        let bkt_gaps: Vec<String> = sqlx::query_scalar::<_, String>(
            r#"
            SELECT t.name FROM user_skill_states uss
            JOIN topics t ON uss.skill_id = t.id
            WHERE uss.user_id = $1
            ORDER BY uss.p_known ASC
            LIMIT 5
            "#,
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        .map_err(|error| format!("Failed to load weak topics: {error}"))?;
        gaps.extend(bkt_gaps);
        if !gaps.is_empty() {
            obs_metrics::inc_bkt_gaps_derived();
        }
    }

    if gaps.is_empty() {
        return Ok(Vec::new());
    }

    let mut recommendations = Vec::new();

    for (idx, gap) in gaps.iter().enumerate() {
        let priority = match idx {
            0 | 1 => "high",
            2 => "medium",
            _ => "low",
        };

        let resource_id = sqlx::query_scalar::<_, String>(
            "SELECT id FROM materials WHERE title ILIKE $1 OR description ILIKE $1 LIMIT 1",
        )
        .bind(format!("%{}%", gap))
        .fetch_optional(pool)
        .await
        .map_err(|error| format!("Failed to find material for topic {gap}: {error}"))?;

        let estimated_hours = match priority {
            "high" => 10 + (idx as i32 * 2),
            "medium" => 5 + (idx as i32),
            _ => 2 + (idx as i32 / 2),
        };

        recommendations.push(StudyRecommendation {
            recommendation: format!(
                "Review and practice: {}. Focus on understanding the fundamentals.",
                gap
            ),
            priority: priority.to_string(),
            estimated_time_hours: estimated_hours,
            resource_id,
        });
    }

    Ok(recommendations)
}
