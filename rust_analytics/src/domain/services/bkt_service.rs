use async_trait::async_trait;
use sqlx::{Pool, Postgres};

#[async_trait]
pub trait BktRepository: Send + Sync {
    async fn get_bkt_params(
        &self,
        skill_id: &str,
    ) -> Result<Option<crate::modules::analytics::performance::bkt::BKTParams>, String>;
    async fn get_user_skill_state(
        &self,
        user_id: &str,
        skill_id: &str,
    ) -> Result<Option<f64>, String>;
    async fn update_user_skill_state(
        &self,
        user_id: &str,
        skill_id: &str,
        p_known: f64,
    ) -> Result<(), String>;
}

pub async fn predict_bkt(
    user_id: &str,
    skill_id: &str,
    _feature_vector: &[f64],
    pool: &Pool<Postgres>,
) -> Result<(f64, f64), String> {
    if user_id.trim().is_empty() || skill_id.trim().is_empty() {
        return Err("user_id and skill_id are required".to_string());
    }

    let p_known = sqlx::query_scalar::<_, f64>(
        "SELECT p_known FROM user_skill_states WHERE user_id = $1 AND skill_id = $2",
    )
    .bind(user_id)
    .bind(skill_id)
    .fetch_optional(pool)
    .await
    .map_err(|error| format!("Failed to load BKT skill state: {error}"))?
    .unwrap_or_else(|| crate::modules::analytics::performance::bkt::BKTParams::default().p_init);

    if !p_known.is_finite() {
        return Err("Stored BKT knowledge probability is not finite".to_string());
    }

    let p_known = p_known.clamp(0.0, 1.0);
    let params = crate::modules::analytics::performance::bkt::BKTParams::default();
    let p_next_correct =
        crate::modules::analytics::performance::bkt::predict_next_correct(p_known, &params);

    Ok((p_known, p_next_correct))
}
