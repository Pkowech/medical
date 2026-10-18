use crate::analytics_proto::{
    GetNextAdaptiveQuestionRequest, GetNextAdaptiveQuestionResponse, GetUserAbilityRequest,
    GetUserAbilityResponse,
};
use crate::observability::metrics as obs_metrics;
use sqlx::{Pool, Postgres, Row};
use tonic::{Request, Response, Status};

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

    fn difficulty_value(difficulty: &str) -> Result<f64, Status> {
        match difficulty {
            "easy" => Ok(0.2),
            "medium" => Ok(0.5),
            "hard" => Ok(0.8),
            _ => Err(Status::internal(format!(
                "Unsupported question difficulty: {difficulty}"
            ))),
        }
    }

    pub async fn get_user_ability(
        &self,
        request: Request<GetUserAbilityRequest>,
    ) -> Result<Response<GetUserAbilityResponse>, Status> {
        let user_id = request.into_inner().user_id;
        Self::validate_user_id(&user_id)?;

        let skills: Vec<(String, f64)> =
            sqlx::query_as("SELECT skill_id, p_known FROM user_skill_states WHERE user_id = $1")
                .bind(&user_id)
                .fetch_all(&self.pool)
                .await
                .map_err(|error| {
                    Status::internal(format!("Failed to load user skill states: {error}"))
                })?;

        let estimated_ability = if skills.is_empty() {
            DEFAULT_USER_ABILITY
        } else {
            (skills.iter().map(|(_, p_known)| p_known).sum::<f64>() / skills.len() as f64)
                .clamp(0.0, 1.0)
        };
        let p_known_by_skill = skills.into_iter().collect();

        Ok(Response::new(GetUserAbilityResponse {
            user_id,
            estimated_ability,
            p_known_by_skill,
        }))
    }

    pub async fn get_next_adaptive_question(
        &self,
        request: Request<GetNextAdaptiveQuestionRequest>,
    ) -> Result<Response<GetNextAdaptiveQuestionResponse>, Status> {
        let req = request.into_inner();
        Self::validate_user_id(&req.user_id)?;

        let skills: Vec<(String, f64)> = sqlx::query_as(
            r#"
            SELECT state.skill_id, state.p_known
            FROM user_skill_states state
            LEFT JOIN topics topic ON topic.id = state.skill_id
            LEFT JOIN units unit ON unit.id = topic.unit_id
            WHERE state.user_id = $1
              AND ($2 = '' OR state.skill_id = $2)
              AND ($3 = '' OR unit.course_id = $3)
              AND ($4 = '' OR topic.unit_id = $4)
            "#,
        )
        .bind(&req.user_id)
        .bind(&req.topic_id)
        .bind(&req.course_id)
        .bind(&req.unit_id)
        .fetch_all(&self.pool)
        .await
        .map_err(|error| {
            Status::internal(format!("Failed to load scoped user skill states: {error}"))
        })?;

        let ability = if !skills.is_empty() {
            (skills.iter().map(|(_, p_known)| p_known).sum::<f64>() / skills.len() as f64)
                .clamp(0.0, 1.0)
        } else {
            DEFAULT_USER_ABILITY
        };
        let target_difficulty = (ability + DIFFICULTY_OFFSET).clamp(MIN_DIFFICULTY, MAX_DIFFICULTY);

        let row = sqlx::query(
            r#"
            SELECT q.id, q.difficulty::text AS difficulty
            FROM questions q
            WHERE q.is_active = TRUE
              AND q.type IN ('multiple_choice', 'true_false')
                AND ($2 = '' OR q.course_id = $2)
              AND ($3 = '' OR q.unit_id = $3)
              AND ($4 = '' OR $4 = ANY(q.topic_ids))
              AND NOT EXISTS (
                  SELECT 1
                  FROM user_responses ur
                  WHERE ur.user_id = $1 AND ur.question_id = q.id
              )
              AND ABS(
                  CASE q.difficulty::text
                      WHEN 'easy' THEN 0.2
                      WHEN 'medium' THEN 0.5
                      WHEN 'hard' THEN 0.8
                  END - $5
              ) <= $6
            ORDER BY ABS(
                CASE q.difficulty::text
                    WHEN 'easy' THEN 0.2
                    WHEN 'medium' THEN 0.5
                    WHEN 'hard' THEN 0.8
                END - $5
            ), RANDOM()
            LIMIT 1
            "#,
        )
        .bind(&req.user_id)
        .bind(&req.course_id)
        .bind(&req.unit_id)
        .bind(&req.topic_id)
        .bind(target_difficulty)
        .bind(DIFFICULTY_RANGE)
        .fetch_optional(&self.pool)
        .await
        .map_err(|error| Status::internal(format!("Question selection failed: {error}")))?;

        let Some(row) = row else {
            return Ok(Response::new(GetNextAdaptiveQuestionResponse {
                question_id: String::new(),
                recommended_difficulty: target_difficulty,
            }));
        };

        let question_id: String = row
            .try_get("id")
            .map_err(|error| Status::internal(format!("Invalid question row: {error}")))?;
        let difficulty: String = row
            .try_get("difficulty")
            .map_err(|error| Status::internal(format!("Invalid difficulty value: {error}")))?;
        let recommended_difficulty = Self::difficulty_value(&difficulty)?;

        let metric_topic = if !req.topic_id.is_empty() {
            req.topic_id
        } else if !req.unit_id.is_empty() {
            req.unit_id
        } else if !req.course_id.is_empty() {
            req.course_id
        } else {
            UNKNOWN_TOPIC.to_string()
        };
        obs_metrics::inc_adaptive_question_selected(&metric_topic);

        Ok(Response::new(GetNextAdaptiveQuestionResponse {
            question_id,
            recommended_difficulty,
        }))
    }
}
