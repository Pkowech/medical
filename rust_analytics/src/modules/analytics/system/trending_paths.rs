use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Serialize, Deserialize)]
pub struct TrendingPath {
    pub path_id: String,
    pub name: String,
    pub popularity: i32,
}

pub async fn get_trending_paths(limit: i32, pool: &Pool<Postgres>) -> Result<Vec<TrendingPath>, String> {
    let paths = sqlx::query_as!(
        TrendingPath,
        r#"
        SELECT p.id as "path_id!", p.title as "name!", COUNT(lpp.id)::int as "popularity!"
        FROM learning_paths p
        LEFT JOIN learning_path_progress lpp ON p.id = lpp.learning_path_id
        GROUP BY p.id, p.title
        ORDER BY "popularity!" DESC
        LIMIT $1
        "#,
        limit as i64
    )
    .fetch_all(pool)
    .await
    .map_err(|e| e.to_string())?;

    Ok(paths)
}
