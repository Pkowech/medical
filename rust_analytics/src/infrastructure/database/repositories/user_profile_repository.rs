/// Postgres implementation of UserProfileRepository
/// Manages persistence of user profile data

use crate::domain::repositories::UserProfileRepository;
use crate::shared::error::AnalyticsError;
use sqlx::{Pool, Postgres, Row};
use std::sync::Arc;
#[cfg(feature = "ml")]
use crate::modules::analytics::core::feature_extraction;
use serde_json::Value as JsonValue;

// Define UserProfile locally if not available in domain::models
#[derive(Debug, Clone)]
pub struct UserProfile {
    pub user_id: String,
    pub learning_style: Option<String>,
    pub preferred_language: Option<String>,
    pub timezone: Option<String>,
}

pub struct PostgresUserProfileRepository {
    pool: Arc<Pool<Postgres>>,
}

impl PostgresUserProfileRepository {
    pub fn new(pool: Arc<Pool<Postgres>>) -> Self {
        Self { pool }
    }
}

impl PostgresUserProfileRepository {
    pub async fn create_user_profile(
        &self,
        user_profile: UserProfile,
    ) -> Result<UserProfile, AnalyticsError> {
        let row = sqlx::query(
            r#"
            INSERT INTO user_profiles (user_id, learning_style, preferred_language, timezone)
            VALUES ($1, $2, $3, $4)
            RETURNING user_id, learning_style, preferred_language, timezone
            "#
        )
        .bind(&user_profile.user_id)
        .bind(&user_profile.learning_style)
        .bind(&user_profile.preferred_language)
        .bind(&user_profile.timezone)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(
            format!("Failed to create user profile: {}", e)
        ))?;

        Ok(UserProfile {
            user_id: row.try_get("user_id").unwrap_or_default(),
            learning_style: row.try_get("learning_style").ok(),
            preferred_language: row.try_get("preferred_language").ok(),
            timezone: row.try_get("timezone").ok(),
        })
    }

    pub async fn get_user_profile(&self, user_id: &str) -> Result<UserProfile, AnalyticsError> {
        let row = sqlx::query(
            r#"
            SELECT user_id, learning_style, preferred_language, timezone
            FROM user_profiles
            WHERE user_id = $1
            "#
        )
        .bind(user_id)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| {
            if let sqlx::Error::RowNotFound = e {
                AnalyticsError::NotFound("User profile not found".to_string())
            } else {
                AnalyticsError::DatabaseError(format!("Failed to fetch user profile: {}", e))
            }
        })?;

        Ok(UserProfile {
            user_id: row.try_get("user_id").unwrap_or_default(),
            learning_style: row.try_get("learning_style").ok(),
            preferred_language: row.try_get("preferred_language").ok(),
            timezone: row.try_get("timezone").ok(),
        })
    }

    pub async fn update_user_profile(
        &self,
        user_profile: UserProfile,
    ) -> Result<UserProfile, AnalyticsError> {
        let row = sqlx::query(
            r#"
            UPDATE user_profiles
            SET learning_style = $2, preferred_language = $3, timezone = $4
            WHERE user_id = $1
            RETURNING user_id, learning_style, preferred_language, timezone
            "#
        )
        .bind(&user_profile.user_id)
        .bind(&user_profile.learning_style)
        .bind(&user_profile.preferred_language)
        .bind(&user_profile.timezone)
        .fetch_one(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(
            format!("Failed to update user profile: {}", e)
        ))?;

        Ok(UserProfile {
            user_id: row.try_get("user_id").unwrap_or_default(),
            learning_style: row.try_get("learning_style").ok(),
            preferred_language: row.try_get("preferred_language").ok(),
            timezone: row.try_get("timezone").ok(),
        })
    }
}


#[async_trait::async_trait]
impl UserProfileRepository for PostgresUserProfileRepository {
#[cfg(feature = "ml")]
    async fn get_user_features(&self, user_id: &str) -> Result<crate::modules::analytics::core::feature_extraction::UserFeatures, AnalyticsError> {
        match feature_extraction::extract_user_features(user_id.to_string(), &*self.pool).await {
            Ok(features) => Ok(features),
            Err(e) => Err(AnalyticsError::DatabaseError(format!("Failed to extract user features: {}", e))),
        }
    }

    async fn get_user_preferences(&self, user_id: &str) -> Result<serde_json::Value, AnalyticsError> {
        let row_opt = sqlx::query("SELECT preferences FROM users WHERE id = $1")
            .bind(user_id)
            .fetch_optional(&*self.pool)
            .await
            .map_err(|e| AnalyticsError::DatabaseError(format!("Failed to fetch user preferences: {}", e)))?;

        if let Some(row) = row_opt {
            let pref: JsonValue = row.try_get("preferences").unwrap_or(JsonValue::Null);
            Ok(pref)
        } else {
            Ok(JsonValue::Null)
        }
    }

    #[cfg(feature = "ml")]
    async fn get_learning_history(&self, user_id: &str) -> Result<Vec<crate::modules::analytics::core::feature_extraction::LearningHistoryItem>, AnalyticsError> {
        let history = sqlx::query_as::<_, crate::modules::analytics::core::feature_extraction::LearningHistoryItem>(
            r#"
            SELECT 
                qa.quiz_id as material_id, 
                qa.score as score,
                0 as duration,
                'quiz' as category,
                (qa.started_at AT TIME ZONE 'UTC') as timestamp,
                0.5 as difficulty,
                1.0 as engagement,
                'quiz' as item_type,
                qa.score as interaction_score
            FROM quiz_attempts qa
            WHERE qa.user_id = $1
            ORDER BY qa.started_at DESC
            LIMIT 50
            "#
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(e.to_string()))?;

        Ok(history)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    // Assuming a test setup function for `Pool<Postgres>`
    // use crate::test_utils::setup_test_db;

    #[tokio::test]
    #[ignore] // Requires a running Postgres instance for integration testing
    async fn test_create_and_get_user_profile() {
        // let pool = setup_test_db().await;
        // let repo = PostgresUserProfileRepository::new(pool.clone());

        // let new_profile = UserProfile {
        //     user_id: "test_user_456".to_string(),
        //     learning_style: Some("visual".to_string()),
        //     preferred_language: Some("en".to_string()),
        //     timezone: Some("America/New_York".to_string()),
        // };

        // let created_profile = repo.create_user_profile(new_profile.clone()).await.unwrap();
        // assert_eq!(created_profile.user_id, new_profile.user_id);
        // assert_eq!(created_profile.learning_style, new_profile.learning_style);

        // let fetched_profile = repo.get_user_profile("test_user_456").await.unwrap();
        // assert_eq!(fetched_profile.user_id, new_profile.user_id);
        // assert_eq!(fetched_profile.preferred_language, new_profile.preferred_language);
    }

    #[tokio::test]
    #[ignore]
    async fn test_update_user_profile() {
        // Similar setup as above
        // let pool = setup_test_db().await;
        // let repo = PostgresUserProfileRepository::new(pool.clone());

        // // Create a profile first
        // let initial_profile = UserProfile {
        //     user_id: "update_test_user_789".to_string(),
        //     learning_style: Some("auditory".to_string()),
        //     preferred_language: Some("fr".to_string()),
        //     timezone: None,
        // };
        // repo.create_user_profile(initial_profile.clone()).await.unwrap();

        // // Update the profile
        // let updated_profile_data = UserProfile {
        //     user_id: "update_test_user_789".to_string(),
        //     learning_style: Some("kinesthetic".to_string()),
        //     preferred_language: Some("es".to_string()),
        //     timezone: Some("Europe/London".to_string()),
        // };
        // let updated_profile = repo.update_user_profile(updated_profile_data.clone()).await.unwrap();

        // assert_eq!(updated_profile.learning_style, Some("kinesthetic".to_string()));
        // assert_eq!(updated_profile.preferred_language, Some("es".to_string()));
        // assert_eq!(updated_profile.timezone, Some("Europe/London".to_string()));
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_nonexistent_profile() {
        // let pool = setup_test_db().await;
        // let repo = PostgresUserProfileRepository::new(pool.clone());

        // let error = repo.get_user_profile("non_existent_user").await;
        // assert!(matches!(error, Err(AnalyticsError::NotFound(_))));
    }
}

