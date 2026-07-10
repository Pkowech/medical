use serde::{Deserialize, Serialize};
use sqlx::{Error, Pool, Postgres};

#[derive(Serialize, Deserialize)]
pub struct UserPerformanceProfile {
    pub user_id: String,
    pub overall_score: f64,
    pub category_abilities: serde_json::Value,
    pub recent_performance: serde_json::Value,
    pub total_courses: i32,
    pub completed_courses: i32,
    pub total_learning_paths: i32,
    pub completed_learning_paths: i32,
    pub overall_ability: f64,
    pub performance_metrics: serde_json::Value,
    pub strengths: Vec<String>,
    pub weaknesses: Vec<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skill_prob_by_skill: Option<serde_json::Value>,
}

#[derive(Debug, sqlx::FromRow)]
pub struct QuizAttempt {
    pub score: f64,
}

#[derive(Debug, sqlx::FromRow)]
pub struct CourseEnrollment {
    pub status: String,
}

#[derive(Debug, sqlx::FromRow)]
pub struct LearningPathProgress {
    pub status: String,
}

pub async fn get_user_performance_profile(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<UserPerformanceProfile, Error> {
    // Fetch quiz attempts
    let quiz_attempts =
        sqlx::query_as::<_, QuizAttempt>("SELECT score FROM quiz_attempts WHERE user_id = $1")
            .bind(user_id)
            .fetch_all(pool)
            .await?;

    let overall_score = if quiz_attempts.is_empty() {
        0.0
    } else {
        quiz_attempts.iter().map(|a| a.score).sum::<f64>() / quiz_attempts.len() as f64
    };

    // Fetch course enrollments
    let course_enrollments = sqlx::query_as::<_, CourseEnrollment>(
        "SELECT status FROM course_enrollments WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let total_courses = course_enrollments.len() as i32;
    let completed_courses = course_enrollments
        .iter()
        .filter(|e| e.status == "completed")
        .count() as i32;

    // Fetch learning path progress
    let learning_path_progress = sqlx::query_as::<_, LearningPathProgress>(
        "SELECT status FROM learning_path_progress WHERE user_id = $1",
    )
    .bind(user_id)
    .fetch_all(pool)
    .await?;

    let total_learning_paths = learning_path_progress.len() as i32;
    let completed_learning_paths = learning_path_progress
        .iter()
        .filter(|p| p.status == "completed")
        .count() as i32;

    // Fetch user BKT skill probabilities and include as JSON map (skill_id -> p_known)
    let skill_states_rows = sqlx::query!(
        r#"SELECT skill_id, p_known FROM user_skill_states WHERE user_id = $1"#,
        user_id
    )
    .fetch_all(pool)
    .await?;

    let mut skill_map = serde_json::Map::new();
    for r in skill_states_rows.into_iter() {
        skill_map.insert(r.skill_id.clone(), serde_json::json!(r.p_known));
    }
    let skill_prob_by_skill = if skill_map.is_empty() {
        None
    } else {
        Some(serde_json::Value::Object(skill_map))
    };

    Ok(UserPerformanceProfile {
        user_id: user_id.to_string(),
        overall_score,
        category_abilities: serde_json::json!({}), // Placeholder
        recent_performance: serde_json::json!({ "correct": 0, "total": 0, "averageTime": 0 }), // Placeholder
        total_courses,
        completed_courses,
        total_learning_paths,
        completed_learning_paths,
        overall_ability: overall_score / 100.0, // Normalize to 0-1
        performance_metrics: serde_json::json!({}), // Placeholder
        strengths: vec![],                      // Placeholder
        weaknesses: vec![],                     // Placeholder
        skill_prob_by_skill,
    })
}
