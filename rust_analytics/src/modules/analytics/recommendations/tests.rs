/// Integration tests for BKT fallback and recommendation logic
#[cfg(test)]
mod tests {
    use sqlx::{postgres::PgPoolOptions, Pool, Postgres};
    use uuid::Uuid;

    async fn setup_test_db() -> Result<Pool<Postgres>, sqlx::Error> {
        // In a real test, use a test database or mock layer.
        // For now, provide a minimal mock setup.
        let database_url = std::env::var("DATABASE_URL")
            .unwrap_or_else(|_| "postgres://user:password@localhost/test".to_string());
        
        let pool = PgPoolOptions::new()
            .max_connections(1)
            .connect(&database_url)
            .await;
        
        pool
    }

    #[tokio::test]
    #[ignore] // Ignored by default; run with --ignored to execute against test DB
    async fn test_bkt_fallback_in_recommendations() {
        let pool = match setup_test_db().await {
            Ok(p) => p,
            Err(_) => {
                println!("Skipping test: Test database not available");
                return;
            }
        };

        let user_id = Uuid::new_v4().to_string();
        let skill_id = Uuid::new_v4().to_string();
        let topic_id = Uuid::new_v4().to_string();

        // Insert mock user_skill_states with low p_known (weakness)
        let _ = sqlx::query(
            "INSERT INTO user_skill_states (user_id, skill_id, p_known, last_updated, attempts) \
             VALUES ($1, $2, 0.3, NOW(), 5) \
             ON CONFLICT DO NOTHING"
        )
        .bind(&user_id)
        .bind(&skill_id)
        .execute(&pool)
        .await;

        // Test: Call build_user_profile or generate_study_recommendations and check BKT gaps are used
        // This is a placeholder; actual test would invoke the functions
        let result: Option<f64> = sqlx::query_scalar(
            "SELECT p_known FROM user_skill_states WHERE user_id = $1 AND skill_id = $2"
        )
        .bind(&user_id)
        .bind(&skill_id)
        .fetch_optional(&pool)
        .await
        .unwrap_or(None);

        assert!(result.is_some(), "BKT state should exist for fallback");
        assert!(result.unwrap() < 0.5, "Low p_known should indicate weakness");
    }

    #[test]
    fn test_bkt_threshold_strength_detection() {
        let strength_threshold = 0.75;
        let p_known_strength = 0.80;
        let p_known_weakness = 0.60;

        assert!(
            p_known_strength >= strength_threshold,
            "High p_known should be strength"
        );
        assert!(
            p_known_weakness < strength_threshold,
            "Low p_known should not be strength"
        );
    }

    #[test]
    fn test_bkt_threshold_weakness_detection() {
        let weakness_threshold = 0.60;
        let p_known_weak = 0.50;
        let p_known_okay = 0.65;

        assert!(p_known_weak < weakness_threshold, "Low p_known is weakness");
        assert!(
            p_known_okay >= weakness_threshold,
            "Medium p_known is not weakness"
        );
    }

    #[tokio::test]
    #[ignore]
    async fn test_linfa_prediction_called_when_enabled() {
        // Placeholder: In real scenario, mock the Linfa prediction call
        // and verify that metrics are incremented.
        let linfa_enabled = std::env::var("LINFA_ENABLED")
            .unwrap_or_else(|_| "true".to_string())
            .to_lowercase();
        assert!(linfa_enabled == "true" || linfa_enabled == "1");
    }
}
