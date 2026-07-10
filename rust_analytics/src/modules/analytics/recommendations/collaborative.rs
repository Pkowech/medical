use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct CollaborativeRecommendation {
    pub item_id: String,
    pub score: f64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reason: Option<String>,
}

#[derive(Debug, Clone)]
struct UserSimilarity {
    user_id: String,
    similarity_score: f64,
}

#[derive(Debug, Clone)]
struct ItemPopularity {
    item_id: String,
    completion_count: i32,
    avg_score: f64,
    avg_time_to_complete: f64,
}

/// Get collaborative filtering recommendations
/// Production implementation using user-item matrix and similarity calculation
pub async fn get_collaborative_recommendations(
    user_id: &str,
    limit: i32,
    pool: &Pool<Postgres>,
) -> Result<Vec<CollaborativeRecommendation>, String> {
    // Step 1: Find similar users based on completed learning paths
    let similar_users = find_similar_users_from_db(user_id, pool).await?;

    if similar_users.is_empty() {
        // Fallback to popularity-based recommendations for new users
        return get_popular_recommendations(user_id, limit, pool).await;
    }

    // Step 2: Get items completed by similar users
    let candidate_items = get_items_from_similar_users(&similar_users, pool).await?;

    // Step 3: Filter out items already completed by current user
    let user_completed = get_user_completed_items(user_id, pool).await?;
    let filtered_items: Vec<ItemPopularity> = candidate_items
        .into_iter()
        .filter(|item| !user_completed.contains(&item.item_id))
        .collect();

    // Step 4: Score items based on similarity-weighted popularity
    let mut recommendations: Vec<CollaborativeRecommendation> = filtered_items
        .into_iter()
        .map(|item| {
            let score = calculate_collaborative_score(&item, &similar_users);
            CollaborativeRecommendation {
                item_id: item.item_id,
                score,
                reason: Some(format!(
                    "Recommended by {} similar learners with avg completion time of {:.1} hours",
                    item.completion_count,
                    item.avg_time_to_complete / 60.0
                )),
            }
        })
        .collect();

    // Step 5: Sort by score and limit results
    recommendations.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    recommendations.truncate(limit as usize);

    Ok(recommendations)
}

/// Find users similar to the given user based on completed items
async fn find_similar_users_from_db(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<Vec<UserSimilarity>, String> {
    // Get user's completed learning paths
    let user_paths: Vec<String> = sqlx::query_scalar!(
        r#"
        SELECT learning_path_id
        FROM learning_path_progress
        WHERE user_id = $1 AND status = 'completed'
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch user paths: {}", e))?;

    if user_paths.is_empty() {
        return Ok(Vec::new());
    }

    // Find users who completed similar paths
    let similar_users_data = sqlx::query!(
        r#"
        SELECT 
            user_id,
            COUNT(*)::int as "common_paths!",
            AVG(overall_progress_percentage) as "avg_progress!"
        FROM learning_path_progress
        WHERE learning_path_id = ANY($1)
        AND user_id != $2
        AND status = 'completed'
        GROUP BY user_id
        HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC
        LIMIT 20
        "#,
        &user_paths,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to find similar users: {}", e))?;

    // Calculate similarity scores using Jaccard coefficient
    let user_path_count = user_paths.len() as f64;
    let mut similarities: Vec<UserSimilarity> = Vec::new();

    for record in similar_users_data {
        let common_count = record.common_paths as f64;

        // Query total paths for this similar user
        let similar_user_total = sqlx::query_scalar!(
            r#"
            SELECT COUNT(*)::int as "count!"
            FROM learning_path_progress
            WHERE user_id = $1 AND status = 'completed'
            "#,
            &record.user_id
        )
        .fetch_one(pool)
        .await
        .unwrap_or(0) as f64;

        // Jaccard similarity: intersection / union
        let union = user_path_count + similar_user_total - common_count;
        let similarity = if union > 0.0 {
            common_count / union
        } else {
            0.0
        };

        // Bonus for high avg progress
        let progress_bonus = (record.avg_progress / 100.0) * 0.1;
        let final_similarity = (similarity + progress_bonus).min(1.0);

        similarities.push(UserSimilarity {
            user_id: record.user_id,
            similarity_score: final_similarity,
        });
    }

    // Sort by similarity score
    similarities.sort_by(|a, b| {
        b.similarity_score
            .partial_cmp(&a.similarity_score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });

    Ok(similarities)
}

/// Get items completed by similar users with popularity metrics
async fn get_items_from_similar_users(
    similar_users: &[UserSimilarity],
    pool: &Pool<Postgres>,
) -> Result<Vec<ItemPopularity>, String> {
    let user_ids: Vec<String> = similar_users.iter().map(|u| u.user_id.clone()).collect();

    let items = sqlx::query!(
        r#"
        SELECT 
            learning_path_id as "item_id!",
            COUNT(*)::int as "completion_count!",
            AVG(overall_progress_percentage)::float8 as "avg_score!",
            AVG(total_time_spent_minutes)::float8 as "avg_time!"
        FROM learning_path_progress
        WHERE user_id = ANY($1)
        AND status = 'completed'
        GROUP BY learning_path_id
        HAVING COUNT(*) >= 2
        ORDER BY COUNT(*) DESC
        "#,
        &user_ids
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch items from similar users: {}", e))?;

    let popularities: Vec<ItemPopularity> = items
        .into_iter()
        .map(|r| ItemPopularity {
            item_id: r.item_id,
            completion_count: r.completion_count,
            avg_score: r.avg_score,
            avg_time_to_complete: r.avg_time,
        })
        .collect();

    Ok(popularities)
}

/// Get items already completed by user
async fn get_user_completed_items(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<Vec<String>, String> {
    let items = sqlx::query_scalar!(
        r#"
        SELECT learning_path_id
        FROM learning_path_progress
        WHERE user_id = $1
        "#,
        user_id
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch user completed items: {}", e))?;

    Ok(items)
}

/// Calculate collaborative score for an item
fn calculate_collaborative_score(item: &ItemPopularity, similar_users: &[UserSimilarity]) -> f64 {
    // Base score from completion count (normalized)
    let popularity_score = (item.completion_count as f64 / 20.0).min(1.0);

    // Score from average progress (higher is better)
    let quality_score = item.avg_score / 100.0;

    // Penalty for very long completion times (may indicate difficulty)
    let time_factor = if item.avg_time_to_complete > 2000.0 {
        0.8
    } else {
        1.0
    };

    // Weight by similarity of users who completed it
    let similarity_weight = similar_users
        .iter()
        .take(10)
        .map(|u| u.similarity_score)
        .sum::<f64>()
        / (10_f64).max(similar_users.len() as f64);

    // Final weighted score
    let score =
        (popularity_score * 0.3 + quality_score * 0.3 + similarity_weight * 0.4) * time_factor;

    score.min(1.0).max(0.0)
}

/// Get popular recommendations as fallback for new users
async fn get_popular_recommendations(
    user_id: &str,
    limit: i32,
    pool: &Pool<Postgres>,
) -> Result<Vec<CollaborativeRecommendation>, String> {
    let popular_items = sqlx::query!(
        r#"
        SELECT 
            lp.id,
            COUNT(lpp.id)::int as "completion_count!",
            AVG(lpp.overall_progress_percentage)::float8 as "avg_progress!",
            AVG(lpp.total_time_spent_minutes)::float8 as "avg_time!"
        FROM learning_paths lp
        INNER JOIN learning_path_progress lpp ON lp.id = lpp.learning_path_id
        WHERE lp.status = 'published'
        AND lpp.status = 'completed'
        AND NOT EXISTS (
            SELECT 1 FROM learning_path_progress lpp2
            WHERE lpp2.learning_path_id = lp.id
            AND lpp2.user_id = $1
        )
        GROUP BY lp.id
        HAVING COUNT(lpp.id) >= 3
        ORDER BY COUNT(lpp.id) DESC, AVG(lpp.overall_progress_percentage) DESC
        LIMIT $2
        "#,
        user_id,
        limit as i64
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Failed to fetch popular items: {}", e))?;

    let recommendations: Vec<CollaborativeRecommendation> = popular_items
        .into_iter()
        .enumerate()
        .map(|(idx, item)| {
            let score = 0.85 - (idx as f64 * 0.05);
            CollaborativeRecommendation {
                item_id: item.id,
                score: score.max(0.5),
                reason: Some(format!(
                    "Popular choice - completed by {} learners with {:.0}% avg progress",
                    item.completion_count, item.avg_progress
                )),
            }
        })
        .collect();

    Ok(recommendations)
}

#[allow(dead_code)]
pub fn calculate_user_similarity(user1_features: &[f64], user2_features: &[f64]) -> f64 {
    if user1_features.len() != user2_features.len() || user1_features.is_empty() {
        return 0.0;
    }

    let dot_product: f64 = user1_features
        .iter()
        .zip(user2_features.iter())
        .map(|(a, b)| a * b)
        .sum();

    let magnitude1: f64 = user1_features.iter().map(|x| x * x).sum::<f64>().sqrt();
    let magnitude2: f64 = user2_features.iter().map(|x| x * x).sum::<f64>().sqrt();

    if magnitude1 == 0.0 || magnitude2 == 0.0 {
        return 0.0;
    }

    (dot_product / (magnitude1 * magnitude2)).max(0.0).min(1.0)
}
