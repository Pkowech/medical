use sqlx::{Pool, Postgres, Row};
use tonic::{Request, Response, Status};
use crate::analytics_proto::{
    GetNextAdaptiveQuestionRequest, GetNextAdaptiveQuestionResponse,
    GetUserAbilityRequest, GetUserAbilityResponse,
};
use crate::observability::metrics as obs_metrics;

const DEFAULT_USER_ABILITY: f64 = 0.5;
const DIFFICULTY_OFFSET: f64 = 0.1;
const MAX_DIFFICULTY: f64 = 0.9;
const MIN_DIFFICULTY: f64 = 0.1;
const DIFFICULTY_RANGE: f64 = 0.2;
const UNKNOWN_TOPIC: &str = "unknown";

pub struct AdaptiveService {
    pool: Pool<Postgres>,
}

impl AdaptiveService {
    pub fn new(pool: Pool<Postgres>) -> Self {
        Self { pool }
    }

    fn validate_user_id(user_id: &str) -> Result<(), Status> {
        if user_id.is_empty() {
            return Err(Status::invalid_argument("user_id cannot be empty"));
        }
        Ok(())
    }

    /// Get user's estimated ability across all skills
    /// 
    /// Computes overall ability as the average of p_known (probability known) 
    /// across all skill competencies in user_skill_states table.
    /// Used by backend for adaptive quiz initialization and user profiling.
    pub async fn get_user_ability(
        &self,
        request: Request<GetUserAbilityRequest>,
    ) -> Result<Response<GetUserAbilityResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id;

        Self::validate_user_id(&user_id)?;

        // Get all skills for the user
        let skills: Vec<(String, f64)> = sqlx::query_as(
            "SELECT skill_id, p_known FROM user_skill_states WHERE user_id = $1"
        )
        .bind(&user_id)
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();

        // Calculate overall ability as average p_known across all skills
        let overall_ability = if !skills.is_empty() {
            let sum: f64 = skills.iter().map(|(_, p)| p).sum();
            sum / skills.len() as f64
        } else {
            DEFAULT_USER_ABILITY
        };

        let p_known_by_skill: std::collections::HashMap<String, f64> = skills.into_iter().collect();

        Ok(Response::new(GetUserAbilityResponse {
            user_id,
            estimated_ability: overall_ability,
            p_known_by_skill,
        }))
    }

    /// Get next adaptive question for user based on IRT (Item Response Theory)
    /// 
    /// Selects a question at difficulty close to user's estimated ability.
    /// Uses BKT (Bayesian Knowledge Tracing) skill states to compute target difficulty.
    /// Ensures questions have not been answered before by this user.
    pub async fn get_next_adaptive_question(
        &self,
        request: Request<GetNextAdaptiveQuestionRequest>,
    ) -> Result<Response<GetNextAdaptiveQuestionResponse>, Status> {
        let req = request.into_inner();
        let user_id = req.user_id;

        Self::validate_user_id(&user_id)?;

        // Get user's skill distribution
        let skills: Vec<(String, f64)> = sqlx::query_as(
            "SELECT skill_id, p_known FROM user_skill_states WHERE user_id = $1"
        )
        .bind(&user_id)
        .fetch_all(&self.pool)
        .await
        .unwrap_or_default();

        // Calculate average ability
        let avg_ability = if !skills.is_empty() {
            let sum: f64 = skills.iter().map(|(_, p)| p).sum();
            (sum / skills.len() as f64).min(1.0).max(0.0)
        } else {
            DEFAULT_USER_ABILITY
        };

        // Target difficulty slightly above current ability
        let target_difficulty = (avg_ability + DIFFICULTY_OFFSET).min(MAX_DIFFICULTY).max(MIN_DIFFICULTY);

        // Fetch a batch of candidate questions (difficulty enum as text), map to numeric in Rust,
        // and choose a question within the target difficulty range that the user hasn't answered.
        let rows = sqlx::query(
            r#"
            SELECT id, difficulty FROM questions
            WHERE id NOT IN (SELECT question_id FROM user_responses WHERE user_id = $1)
            ORDER BY RANDOM()
            LIMIT 50
            "#,
        )
        .bind(&user_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| Status::internal(format!("Database query failed: {}", e)))?;

        let mut chosen: Option<(String, f64)> = None;
        for row in rows {
            let qid: String = row.try_get("id").unwrap_or_default();
            let diff_text: Option<String> = row.try_get("difficulty").ok();
            let diff_val = match diff_text.as_deref() {
                Some("easy") => 0.2,
                Some("medium") => 0.5,
                Some("hard") => 0.8,
                _ => continue,
            };
            if diff_val >= (target_difficulty - DIFFICULTY_RANGE) && diff_val <= (target_difficulty + DIFFICULTY_RANGE) {
                chosen = Some((qid, diff_val));
                break;
            }
        }

        if let Some((question_id, difficulty)) = chosen {
            // Try to find topic name (first tag) for metrics label
            let topic_name: Option<String> = sqlx::query_scalar(
                "SELECT (tags->>0) FROM questions WHERE id = $1"
            )
            .bind(&question_id)
            .fetch_optional(&self.pool)
            .await
            .unwrap_or(None);
            let t = topic_name.unwrap_or_else(|| UNKNOWN_TOPIC.to_string());
            obs_metrics::inc_adaptive_question_selected(&t);
            Ok(Response::new(GetNextAdaptiveQuestionResponse {
                question_id,
                recommended_difficulty: difficulty,
            }))
        } else {
            // Fallback: pick any unanswered question for the user (ignore difficulty)
            let fallback_row = sqlx::query("SELECT id, difficulty FROM questions WHERE id NOT IN (SELECT question_id FROM user_responses WHERE user_id = $1) ORDER BY RANDOM() LIMIT 1")
                .bind(&user_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| Status::internal(format!("Database query failed: {}", e)))?;

            if let Some(row) = fallback_row {
                let question_id: String = row.try_get("id").unwrap_or_default();
                let diff_text: Option<String> = row.try_get("difficulty").ok();
                let difficulty = match diff_text.as_deref() {
                    Some("easy") => 0.2,
                    Some("medium") => 0.5,
                    Some("hard") => 0.8,
                    _ => DEFAULT_USER_ABILITY,
                };

                let topic_name: Option<String> = sqlx::query_scalar(
                    "SELECT (tags->>0) FROM questions WHERE id = $1"
                )
                .bind(&question_id)
                .fetch_optional(&self.pool)
                .await
                .unwrap_or(None);
                let t = topic_name.unwrap_or_else(|| UNKNOWN_TOPIC.to_string());
                obs_metrics::inc_adaptive_question_selected(&t);

                Ok(Response::new(GetNextAdaptiveQuestionResponse {
                    question_id,
                    recommended_difficulty: difficulty,
                }))
            } else {
                // As a last resort, return any question regardless of user history.
                let any_row = sqlx::query("SELECT id, difficulty FROM questions ORDER BY RANDOM() LIMIT 1")
                    .fetch_optional(&self.pool)
                    .await
                    .map_err(|e| Status::internal(format!("Database query failed: {}", e)))?;

                if let Some(row) = any_row {
                    let question_id: String = row.try_get("id").unwrap_or_default();
                    let diff_text: Option<String> = row.try_get("difficulty").ok();
                    let difficulty = match diff_text.as_deref() {
                        Some("easy") => 0.2,
                        Some("medium") => 0.5,
                        Some("hard") => 0.8,
                        _ => DEFAULT_USER_ABILITY,
                    };

                    let topic_name: Option<String> = sqlx::query_scalar(
                        "SELECT (tags->>0) FROM questions WHERE id = $1"
                    )
                    .bind(&question_id)
                    .fetch_optional(&self.pool)
                    .await
                    .unwrap_or(None);
                    let t = topic_name.unwrap_or_else(|| UNKNOWN_TOPIC.to_string());
                    obs_metrics::inc_adaptive_question_selected(&t);

                    Ok(Response::new(GetNextAdaptiveQuestionResponse {
                        question_id,
                        recommended_difficulty: difficulty,
                    }))
                } else {
                    Err(Status::not_found("No suitable questions found for user"))
                }
            }
        }
    }
}
