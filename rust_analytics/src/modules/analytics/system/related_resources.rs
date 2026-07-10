use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Serialize, Deserialize)]
pub struct Resource {
    pub resource_id: String,
    pub title: String,
    pub resource_type: String,
}

pub async fn get_related_resources(_assessment_id: &str, pool: &Pool<Postgres>) -> Result<Vec<Resource>, String> {
    let resources = sqlx::query_as!(
        Resource,
        r#"
        SELECT id as "resource_id!", title as "title!", type::text as "resource_type!"
        FROM materials
        ORDER BY created_at DESC
        LIMIT 5
        "#
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(resources)
}
