/// Postgres implementation of GoalRepository
/// Manages persistence of learning goals and milestone data

use crate::domain::repositories::GoalRepository;
use crate::domain::models::{Goal, UpcomingDeadline};
use crate::domain::value_objects::ProgressStatus;
use crate::shared::error::AnalyticsError;
use chrono::NaiveDate;
use sqlx::{Pool, Postgres, Row};
use std::sync::Arc;

pub struct PostgresGoalRepository {
    pool: Arc<Pool<Postgres>>,
}

impl PostgresGoalRepository {
    pub fn new(pool: Arc<Pool<Postgres>>) -> Self {
        Self { pool }
    }
}

#[async_trait::async_trait]
impl GoalRepository for PostgresGoalRepository {
    async fn get_user_goals(&self, user_id: &str) -> Result<Vec<Goal>, AnalyticsError> {
        let rows = sqlx::query(
            r#"
            SELECT
                id,
                user_id,
                title,
                status::text as status,
                category,
                COALESCE(priority, 0) as priority,
                target_date,
                completed_at,
                created_at,
                start_date,
                COALESCE(streak_count, 0) as streak_count
            FROM learning_goals
            WHERE user_id = $1
            "#
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(
            format!("Failed to fetch user goals: {}", e)
        ))?;

        let goals = rows
            .into_iter()
            .map(|row| {
                Goal {
                    id: row.try_get("id").unwrap_or_default(),
                    user_id: row.try_get("user_id").unwrap_or_default(),
                    title: row.try_get("title").unwrap_or_default(),
                    status: row.try_get("status").unwrap_or(ProgressStatus::NotStarted),
                    category: row.try_get("category").unwrap_or_default(),
                    priority: row.try_get::<i32, _>("priority").unwrap_or(0).to_string(),
                    target_date: row.try_get("target_date").ok(),
                    completed_at: row.try_get("completed_at").ok(),
                    created_at: row.try_get("created_at").unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
                    start_date: row.try_get("start_date").ok(),
                    streak_count: row.try_get("streak_count").unwrap_or(0),
                }
            })
            .collect();

        Ok(goals)
    }

    async fn get_goals_by_status(
        &self,
        user_id: &str,
        status: &str,
    ) -> Result<Vec<Goal>, AnalyticsError> {
        let rows = sqlx::query(
            r#"
            SELECT
                id,
                user_id,
                title,
                status::text as status,
                category,
                COALESCE(priority, 0) as priority,
                target_date,
                completed_at,
                created_at,
                start_date,
                COALESCE(streak_count, 0) as streak_count
            FROM learning_goals
            WHERE user_id = $1 AND status::text = $2
            "#
        )
        .bind(user_id)
        .bind(status)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(
            format!("Failed to fetch goals by status: {}", e)
        ))?;

        let goals = rows
            .into_iter()
            .map(|row| {
                Goal {
                    id: row.try_get("id").unwrap_or_default(),
                    user_id: row.try_get("user_id").unwrap_or_default(),
                    title: row.try_get("title").unwrap_or_default(),
                    status: row.try_get("status").unwrap_or(ProgressStatus::NotStarted),
                    category: row.try_get("category").unwrap_or_default(),
                    priority: row.try_get::<i32, _>("priority").unwrap_or(0).to_string(),
                    target_date: row.try_get("target_date").ok(),
                    completed_at: row.try_get("completed_at").ok(),
                    created_at: row.try_get("created_at").unwrap_or_else(|_| chrono::Utc::now().naive_utc()),
                    start_date: row.try_get("start_date").ok(),
                    streak_count: row.try_get("streak_count").unwrap_or(0),
                }
            })
            .collect();

        Ok(goals)
    }

    async fn get_upcoming_deadlines(
        &self,
        user_id: &str,
    ) -> Result<Vec<UpcomingDeadline>, AnalyticsError> {
        let rows = sqlx::query(
            r#"
            SELECT
                id,
                title,
                target_date,
                priority
            FROM learning_goals
            WHERE user_id = $1
              AND target_date IS NOT NULL
              AND target_date > CURRENT_DATE
              AND status::text != 'completed'
            ORDER BY target_date ASC
            LIMIT 10
            "#
        )
        .bind(user_id)
        .fetch_all(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(
            format!("Failed to fetch upcoming deadlines: {}", e)
        ))?;

        let deadlines = rows
            .into_iter()
            .map(|row| {
                let target_date = row.try_get::<NaiveDate, _>("target_date").unwrap_or(chrono::Local::now().date_naive() + chrono::Duration::days(7));
                let days_remaining = (target_date - chrono::Local::now().date_naive()).num_days() as i32;
                UpcomingDeadline {
                    goal_id: row.try_get("id").unwrap_or_default(),
                    title: row.try_get("title").unwrap_or_default(),
                    target_date,
                    days_remaining,
                }
            })
            .collect();

        Ok(deadlines)
    }

    async fn update_goal(&self, goal: Goal) -> Result<(), AnalyticsError> {
        sqlx::query(
            r#"
            INSERT INTO learning_goals
                (id, user_id, title, status, category, priority, target_date, completed_at, created_at, start_date, streak_count)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (id)
            DO UPDATE SET
                title = $3,
                status = $4,
                category = $5,
                priority = $6,
                target_date = $7,
                completed_at = $8,
                start_date = $10,
                streak_count = $11
            "#
        )
        .bind(&goal.id)
        .bind(&goal.user_id)
        .bind(&goal.title)
        .bind(&goal.status)
        .bind(&goal.category)
        .bind(goal.priority.parse::<i32>().unwrap_or(0))
        .bind(goal.target_date)
        .bind(goal.completed_at)
        .bind(goal.created_at)
        .bind(goal.start_date)
        .bind(goal.streak_count)
        .execute(&*self.pool)
        .await
        .map_err(|e| AnalyticsError::DatabaseError(
            format!("Failed to update goal: {}", e)
        ))?;

        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    #[ignore]
    async fn test_get_user_goals() {
        // Requires test database
    }

    #[tokio::test]
    #[ignore]
    async fn test_get_upcoming_deadlines() {
        // Requires test database
    }
}

