use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use crate::observability::metrics as obs_metrics;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StudyRecommendation {
    pub recommendation: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub priority: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimated_time_hours: Option<i32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub resource_id: Option<String>,
}

pub async fn generate_study_recommendations(
    user_id: &str,
    knowledge_gaps: &[String],
    pool: &Pool<Postgres>,
) -> Result<Vec<StudyRecommendation>, String> {
    println!(
        "Generating study recommendations for user: {} with gaps: {:?}",
        user_id, knowledge_gaps
    );

    // Work with a local mutable gaps vector, so we can populate it using BKT
    let mut gaps: Vec<String> = knowledge_gaps.to_vec();

    if gaps.is_empty() {
        // Attempt to fetch BKT-derived weakest skills and use them as gaps
        let bkt_gaps: Vec<String> = sqlx::query_scalar!(
            r#"
            SELECT t.name FROM user_skill_states uss
            JOIN topics t ON uss.skill_id = t.id
            WHERE uss.user_id = $1
            ORDER BY uss.p_known ASC
            LIMIT 5
            "#,
            user_id
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default();

        for tg in bkt_gaps.into_iter() {
            gaps.push(tg);
        }
        if !gaps.is_empty() {
            obs_metrics::inc_bkt_gaps_derived();
        }
    }

    if gaps.is_empty() {
        // If no knowledge gaps provided, find courses they haven't taken yet
        match sqlx::query_scalar::<_, String>(
            "SELECT DISTINCT q.course_id FROM quizzes q 
             WHERE q.course_id NOT IN (
                SELECT DISTINCT qa.quiz_id::text FROM quiz_attempts qa
                WHERE qa.user_id = $1
            ) LIMIT 3",
        )
        .bind(user_id)
        .fetch_all(pool)
        .await
        {
            Ok(courses) => {
                if !courses.is_empty() {
                    let mut recommendations = Vec::new();
                    for (idx, course_id) in courses.iter().enumerate() {
                        recommendations.push(StudyRecommendation {
                            recommendation: format!(
                                "Explore new course: {}. Expand your knowledge base.",
                                course_id
                            ),
                            priority: Some(if idx == 0 {
                                "high".to_string()
                            } else {
                                "medium".to_string()
                            }),
                            estimated_time_hours: Some(5 + (idx as i32 * 2)),
                            resource_id: Some(course_id.clone()),
                        });
                    }
                    return Ok(recommendations);
                }
            }
            Err(_) => {}
        }

        // Default recommendation if no new courses available
        return Ok(vec![StudyRecommendation {
            recommendation: "Continue with your current learning path or review weak topics"
                .to_string(),
            priority: Some("low".to_string()),
            estimated_time_hours: Some(0),
            resource_id: None,
        }]);
    }

    let mut recommendations = Vec::new();

    for (idx, gap) in gaps.iter().enumerate() {
        let priority = match idx {
            0 | 1 => "high",
            2 => "medium",
            _ => "low",
        };

        let materials = sqlx::query_scalar::<_, String>(
            "SELECT id FROM materials WHERE title ILIKE $1 OR description ILIKE $1 LIMIT 1",
        )
        .bind(format!("%{}%", gap))
        .fetch_optional(pool)
        .await
        .ok()
        .flatten();

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
            priority: Some(priority.to_string()),
            estimated_time_hours: Some(estimated_hours),
            resource_id: materials,
        });
    }

    recommendations.sort_by(|a, b| {
        let priority_order = |p: &Option<String>| match p.as_deref() {
            Some("high") => 0,
            Some("medium") => 1,
            _ => 2,
        };
        priority_order(&a.priority).cmp(&priority_order(&b.priority))
    });

    Ok(recommendations)
}
