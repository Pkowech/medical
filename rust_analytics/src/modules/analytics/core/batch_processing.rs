use super::data_processor;
use serde::{Deserialize, Serialize};
use sqlx::{Pool, Postgres};
use crate::observability::metrics as obs_metrics;

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchProcessingResult {
    pub success: bool,
    pub message: String,
    pub processed_users: u32,
}

pub async fn process_analytics_for_users(
    pool: &Pool<Postgres>,
    user_ids: &[String],
) -> Result<BatchProcessingResult, String> {
    println!("Processing analytics for users: {:?}", user_ids);
    let mut processed_count = 0;

    for user_id in user_ids {
        match data_processor::get_user_data(pool, user_id).await {
            Ok((progress_df, quizzes_df, study_time_df)) => {
                match data_processor::process_user_data(&progress_df, &quizzes_df, &study_time_df) {
                    Ok(processed_data) => {
                        println!(
                            "Successfully processed data for user {}: {:?}",
                            user_id, processed_data
                        );
                        processed_count += 1;
                    }
                    Err(e) => {
                        eprintln!("Error processing data for user {}: {}", user_id, e);
                    }
                }
            }
            Err(e) => {
                eprintln!("Error fetching data for user {}: {}", user_id, e);
            }
        }
    }

    Ok(BatchProcessingResult {
        success: true,
        message: format!(
            "Processed {} out of {} users.",
            processed_count,
            user_ids.len()
        ),
        processed_users: processed_count,
    })
}

// Compute average p_known per skill across the given user set (or full DB if empty) and set gauge
pub async fn update_bkt_skill_avg_metrics(pool: &Pool<Postgres>) -> Result<(), String> {
    // Query average p_known by skill
    let rows: Vec<(String, f64)> = sqlx::query_as(
        "SELECT skill_id, AVG(p_known) as avg_p_known FROM user_skill_states GROUP BY skill_id"
    )
    .fetch_all(pool)
    .await
    .map_err(|e| format!("DB error fetching skill averages: {}", e))?;

    for (skill_id, avg_p) in rows.into_iter() {
        obs_metrics::set_bkt_skill_avg(&skill_id, avg_p);
    }

    Ok(())
}
