/// Spaced Repetition Analytics Module
/// 
/// Provides analytics and aggregation for spaced repetition (SM-2) metrics.
/// Tracks flashcard progress, intervals, ease factors, and generates insights
/// on user learning patterns and retention rates.
/// 
/// This module connects to the PostgreSQL database to compute:
/// - Retention statistics (pass rate by interval)
/// - Ease factor distributions (learning difficulty)
/// - Review scheduling metrics
/// - User proficiency trends over time

use sqlx::PgPool;
use serde::{Deserialize, Serialize};
use chrono::{DateTime, Utc, Duration};
use thiserror::Error;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SpacedRepetitionStats {
    /// Total number of flashcards reviewed by user
    pub total_cards: i64,
    
    /// Number of cards due for review today
    pub due_today: i64,
    
    /// Number of mastered cards (ease factor >= 2.5 and interval > 30 days)
    pub mastered_cards: i64,
    
    /// Number of cards in learning phase (repetitions < 2)
    pub learning_cards: i64,
    
    /// Number of cards in relearning phase (failed recent review)
    pub relearning_cards: i64,
    
    /// Average ease factor across all cards
    pub avg_ease_factor: f64,
    
    /// Average interval (days) across all cards
    pub avg_interval_days: f64,
    
    /// Pass rate (successful reviews / total reviews) over recent period
    pub recent_pass_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntervalRetention {
    /// Interval duration (days)
    pub interval_days: i32,
    
    /// Number of reviews at this interval
    pub review_count: i64,
    
    /// Number of successful reviews at this interval
    pub successful_reviews: i64,
    
    /// Pass rate at this interval
    pub pass_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EaseFactorDistribution {
    /// Bin range (e.g., "1.3-1.9")
    pub range: String,
    
    /// Minimum ease factor in bin
    pub min_ease: f64,
    
    /// Maximum ease factor in bin
    pub max_ease: f64,
    
    /// Number of cards in this ease factor range
    pub card_count: i64,
    
    /// Average pass rate for cards in this range
    pub avg_pass_rate: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProgressTrend {
    /// Date of the data point
    pub date: DateTime<Utc>,
    
    /// Total unique cards reviewed on this date
    pub cards_reviewed: i64,
    
    /// Success count on this date
    pub successful_reviews: i64,
    
    /// Failed reviews on this date
    pub failed_reviews: i64,
    
    /// Daily pass rate
    pub daily_pass_rate: f64,
    
    /// Average ease factor on this date
    pub avg_ease_factor: f64,
}

#[derive(Debug, Error)]
pub enum SpacedRepetitionError {
    #[error("Database query failed: {0}")]
    DatabaseError(String),
    
    #[error("User not found: {0}")]
    UserNotFound(String),
    
    #[error("Invalid date range")]
    InvalidDateRange,
}

pub struct SpacedRepetitionAnalytics {
    db: PgPool,
}

impl SpacedRepetitionAnalytics {
    pub fn new(db: PgPool) -> Self {
        Self { db }
    }

    /// Get comprehensive spaced repetition statistics for a user
    pub async fn get_user_stats(
        &self,
        user_id: &str,
    ) -> Result<SpacedRepetitionStats, SpacedRepetitionError> {
        let now = Utc::now();
        let seven_days_ago = now - Duration::days(7);

        // Query all user's flashcard progress
        let total_cards: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) 
            FROM user_flashcard_progress 
            WHERE user_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

        // Count due today (next_review <= now)
        let due_today: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) 
            FROM user_flashcard_progress 
            WHERE user_id = $1 
            AND next_review <= $2
            "#,
        )
        .bind(user_id)
        .bind(now)
        .fetch_one(&self.db)
        .await
        .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

        // Count mastered cards (ease_factor >= 2.5 and interval > 30)
        let mastered_cards: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) 
            FROM user_flashcard_progress 
            WHERE user_id = $1 
            AND ease_factor >= 2.5 
            AND interval > 30
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

        // Count learning cards (repetitions < 2 or correct_streak < 2)
        let learning_cards: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) 
            FROM user_flashcard_progress 
            WHERE user_id = $1 
            AND (repetitions < 2 OR correct_streak < 2)
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

        // Count relearning cards (correct_streak = 0 and repetitions > 0)
        let relearning_cards: i64 = sqlx::query_scalar(
            r#"
            SELECT COUNT(*) 
            FROM user_flashcard_progress 
            WHERE user_id = $1 
            AND correct_streak = 0 
            AND repetitions > 0
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

        // Calculate averages
        let (avg_ease_factor, avg_interval): (Option<f64>, Option<i32>) = sqlx::query_as(
            r#"
            SELECT 
              AVG(ease_factor),
              AVG(CAST(interval AS INTEGER))
            FROM user_flashcard_progress 
            WHERE user_id = $1
            "#,
        )
        .bind(user_id)
        .fetch_one(&self.db)
        .await
        .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

        // Calculate recent pass rate from flashcard_results (if available)
        let recent_pass_rate: Option<f64> = sqlx::query_scalar(
            r#"
            SELECT 
              SUM(CASE WHEN passed THEN 1 ELSE 0 END)::FLOAT / 
              NULLIF(COUNT(*)::FLOAT, 0)
            FROM flashcard_results
            WHERE user_id = $1 
            AND attempted_at >= $2
            "#,
        )
        .bind(user_id)
        .bind(seven_days_ago)
        .fetch_one(&self.db)
        .await
        .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

        Ok(SpacedRepetitionStats {
            total_cards,
            due_today,
            mastered_cards,
            learning_cards,
            relearning_cards,
            avg_ease_factor: avg_ease_factor.unwrap_or(2.5),
            avg_interval_days: avg_interval.unwrap_or(0) as f64,
            recent_pass_rate: recent_pass_rate.unwrap_or(0.0),
        })
    }

    /// Get retention rates broken down by interval
    pub async fn get_retention_by_interval(
        &self,
        user_id: &str,
    ) -> Result<Vec<IntervalRetention>, SpacedRepetitionError> {
        let results = sqlx::query_as::<_, (i32, i64, i64)>(
            r#"
            WITH interval_buckets AS (
              SELECT 
                CASE 
                  WHEN interval <= 1 THEN 1
                  WHEN interval <= 6 THEN 6
                  WHEN interval <= 14 THEN 14
                  WHEN interval <= 30 THEN 30
                  WHEN interval <= 90 THEN 90
                  ELSE 180
                END as interval_bucket,
                CASE 
                  WHEN last_review IS NOT NULL AND 
                       (
                         (interval <= 1 AND last_review > NOW() - INTERVAL '1 day') OR
                         (interval <= 6 AND last_review > NOW() - INTERVAL '6 days') OR
                         (interval <= 14 AND last_review > NOW() - INTERVAL '14 days') OR
                         (interval <= 30 AND last_review > NOW() - INTERVAL '30 days') OR
                         (interval <= 90 AND last_review > NOW() - INTERVAL '90 days') OR
                         (interval > 90 AND last_review > NOW() - INTERVAL '180 days')
                       )
                  THEN 1 
                  ELSE 0 
                END as successful
              FROM user_flashcard_progress
              WHERE user_id = $1
            )
            SELECT 
              interval_bucket,
              COUNT(*),
              SUM(successful)
            FROM interval_buckets
            GROUP BY interval_bucket
            ORDER BY interval_bucket
            "#,
        )
        .fetch_all(&self.db)
        .await
        .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

        Ok(results
            .into_iter()
            .map(|(interval, total, successful)| {
                let pass_rate = if total > 0 {
                    successful as f64 / total as f64
                } else {
                    0.0
                };
                IntervalRetention {
                    interval_days: interval,
                    review_count: total,
                    successful_reviews: successful,
                    pass_rate,
                }
            })
            .collect())
    }

    /// Get distribution of ease factors
    pub async fn get_ease_factor_distribution(
        &self,
        user_id: &str,
    ) -> Result<Vec<EaseFactorDistribution>, SpacedRepetitionError> {
        let bins = vec![
            (1.3, 1.9, "1.3-1.9"),
            (1.9, 2.2, "1.9-2.2"),
            (2.2, 2.5, "2.2-2.5"),
            (2.5, 3.0, "2.5-3.0"),
            (3.0, 4.0, "3.0-4.0"),
        ];

        let mut distributions = Vec::new();

        for (min, max, range_str) in bins {
            let card_count: i64 = sqlx::query_scalar(
                r#"
                SELECT COUNT(*) 
                FROM user_flashcard_progress
                WHERE user_id = $1 
                AND ease_factor >= $2 
                AND ease_factor < $3
                "#,
            )
            .bind(user_id)
            .bind(min)
            .bind(max)
            .fetch_one(&self.db)
            .await
            .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

            // Calculate average pass rate for cards in this range
            let avg_pass_rate: Option<f64> = sqlx::query_scalar(
                r#"
                SELECT 
                  COALESCE(
                    SUM(CASE WHEN passed THEN 1 ELSE 0 END)::FLOAT / 
                    NULLIF(COUNT(*)::FLOAT, 0),
                    0.0
                  )
                FROM flashcard_results fr
                INNER JOIN user_flashcard_progress ufp ON fr.user_id = ufp.user_id
                WHERE fr.user_id = $1 
                AND ufp.ease_factor >= $2 
                AND ufp.ease_factor < $3
                "#,
            )
            .bind(user_id)
            .bind(min)
            .bind(max)
            .fetch_one(&self.db)
            .await
            .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

            distributions.push(EaseFactorDistribution {
                range: range_str.to_string(),
                min_ease: min,
                max_ease: max,
                card_count,
                avg_pass_rate: avg_pass_rate.unwrap_or(0.0),
            });
        }

        Ok(distributions)
    }

    /// Get progress trend over time
    pub async fn get_progress_trend(
        &self,
        user_id: &str,
        days: i32,
    ) -> Result<Vec<ProgressTrend>, SpacedRepetitionError> {
        if days <= 0 {
            return Err(SpacedRepetitionError::InvalidDateRange);
        }

        let start_date = Utc::now() - Duration::days(days as i64);

        let results = sqlx::query_as::<_, (DateTime<Utc>, i64, i64, i64)>(
            r#"
            SELECT 
              DATE_TRUNC('day', attempted_at) as date,
              COUNT(DISTINCT unit_id) as cards_reviewed,
              SUM(CASE WHEN passed THEN 1 ELSE 0 END) as successful,
              SUM(CASE WHEN NOT passed THEN 1 ELSE 0 END) as failed
            FROM flashcard_results
            WHERE user_id = $1 
            AND attempted_at >= $2
            GROUP BY DATE_TRUNC('day', attempted_at)
            ORDER BY date DESC
            "#,
        )
        .bind(user_id)
        .bind(start_date)
        .fetch_all(&self.db)
        .await
        .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

        let mut trends = Vec::new();

        for (date, cards_reviewed, successful, failed) in results {
            let total = successful + failed;
            let daily_pass_rate = if total > 0 {
                successful as f64 / total as f64
            } else {
                0.0
            };

            // Get average ease factor for this day
            let avg_ease: Option<f64> = sqlx::query_scalar(
                r#"
                SELECT AVG(ease_factor)
                FROM user_flashcard_progress
                WHERE user_id = $1 
                AND updated_at::date = $2::date
                "#,
            )
            .bind(user_id)
            .bind(date)
            .fetch_one(&self.db)
            .await
            .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

            trends.push(ProgressTrend {
                date,
                cards_reviewed,
                successful_reviews: successful,
                failed_reviews: failed,
                daily_pass_rate,
                avg_ease_factor: avg_ease.unwrap_or(2.5),
            });
        }

        Ok(trends)
    }

    /// Get recommended focus areas based on struggling cards
    pub async fn get_focus_recommendations(
        &self,
        user_id: &str,
        limit: i32,
    ) -> Result<Vec<(String, i64, f64)>, SpacedRepetitionError> {
        let results = sqlx::query_as::<_, (String, i64, Option<f64>)>(
            r#"
            SELECT 
              t.name,
              COUNT(ufp.id) as card_count,
              COALESCE(
                SUM(CASE WHEN fr.passed THEN 1 ELSE 0 END)::FLOAT / 
                NULLIF(COUNT(fr.id)::FLOAT, 0),
                0.0
              ) as pass_rate
            FROM user_flashcard_progress ufp
            INNER JOIN flashcards f ON ufp.flashcard_id = f.id
            INNER JOIN questions q ON f.question_id = q.id
            LEFT JOIN flashcard_results fr ON ufp.user_id = fr.user_id
            LEFT JOIN topics t ON q.unit_id = t.unit_id
            WHERE ufp.user_id = $1 
            AND (ufp.correct_streak = 0 OR ufp.ease_factor < 1.8)
            GROUP BY t.name
            ORDER BY pass_rate ASC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.db)
        .await
        .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

        Ok(results
            .into_iter()
            .map(|(name, count, pass_rate)| (name, count, pass_rate.unwrap_or(0.0)))
            .collect())
    }

    /// Get list of due cards for the user (limited)
    pub async fn get_due_cards(
        &self,
        user_id: &str,
        limit: i64,
    ) -> Result<Vec<(String, Option<String>, String, DateTime<Utc>)>, SpacedRepetitionError> {
        let results = sqlx::query_as::<_, (String, Option<String>, String, DateTime<Utc>)>(
            r#"
            SELECT
              ufp.id as card_id,
              t.id as topic_id,
              q.text as question,
              ufp.next_review
            FROM user_flashcard_progress ufp
            INNER JOIN flashcards f ON ufp.flashcard_id = f.id
            INNER JOIN questions q ON f.question_id = q.id
            LEFT JOIN topics t ON q.unit_id = t.unit_id
            WHERE ufp.user_id = $1
            AND ufp.next_review <= NOW()
            ORDER BY ufp.next_review ASC
            LIMIT $2
            "#,
        )
        .bind(user_id)
        .bind(limit)
        .fetch_all(&self.db)
        .await
        .map_err(|e| SpacedRepetitionError::DatabaseError(e.to_string()))?;

        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_interval_retention_calculation() {
        let retention = IntervalRetention {
            interval_days: 6,
            review_count: 100,
            successful_reviews: 85,
            pass_rate: 0.85,
        };
        assert_eq!(retention.pass_rate, 0.85);
    }

    #[test]
    fn test_ease_factor_distribution_range() {
        let dist = EaseFactorDistribution {
            range: "2.5-3.0".to_string(),
            min_ease: 2.5,
            max_ease: 3.0,
            card_count: 50,
            avg_pass_rate: 0.90,
        };
        assert!(dist.min_ease < dist.max_ease);
        assert_eq!(dist.card_count, 50);
    }
}
