use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Recommendation {
    pub path_id: String,
    pub title: String,
    pub description: String,
    pub score: f64,
    pub reason: String,
}

/// Get AI-based personalized recommendations for a user
pub async fn get_recommendations_ai(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<Vec<Recommendation>, String> {
    // Delegate to the existing implementation in modules for now.
    let recs = crate::modules::analytics::recommendations::service::
        get_recommendations_ai(user_id, pool)
        .await?;

    // Convert concrete Recommendation type from modules to domain Recommendation
    let out: Vec<Recommendation> = recs
        .into_iter()
        .map(|r| Recommendation {
            path_id: r.path_id,
            title: r.title,
            description: r.description,
            score: r.score,
            reason: r.reason,
        })
        .collect();

    Ok(out)
}
