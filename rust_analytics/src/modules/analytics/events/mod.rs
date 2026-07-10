use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
/// Analytics event tracking and batch processing module
use sqlx::{Pool, Postgres, Row};
use uuid::Uuid;

#[allow(dead_code)]
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AnalyticsEvent {
    pub id: Option<String>,
    pub user_id: String,
    pub event_type: String,
    pub data: serde_json::Value,
    pub timestamp: DateTime<Utc>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub session_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub duration: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchEventRequest {
    pub user_id: String,
    pub events: Vec<EventPayload>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EventPayload {
    pub event_type: String,
    pub data: Option<serde_json::Value>,
    pub timestamp: String,
    pub session_id: Option<String>,
    pub duration: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BatchEventResponse {
    pub success: bool,
    pub processed: usize,
    pub failed: usize,
    pub message: String,
}

/// Store a batch of analytics events
/// Writes events to database and returns processing results
pub async fn store_batch_events(
    user_id: &str,
    events: Vec<EventPayload>,
    pool: &Pool<Postgres>,
) -> Result<BatchEventResponse, String> {
    if events.is_empty() {
        return Ok(BatchEventResponse {
            success: true,
            processed: 0,
            failed: 0,
            message: "No events to process".to_string(),
        });
    }

    let mut processed = 0;
    let mut failed = 0;

    for event in events {
        // Generate a unique ID for the event
        let event_id = Uuid::new_v4().to_string();
        
        // Parse timestamp
        let timestamp = DateTime::parse_from_rfc3339(&event.timestamp)
            .map(|dt| dt.with_timezone(&Utc))
            .unwrap_or_else(|_| Utc::now());

        // Insert event into database
        let event_data = event.data.unwrap_or(serde_json::json!({}));

        let result = sqlx::query(
            r#"
            INSERT INTO analytics_events (
                id,
                user_id, 
                event_type, 
                data, 
                timestamp, 
                session_id, 
                duration,
                created_at
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())
            "#,
        )
        .bind(&event_id)
        .bind(user_id)
        .bind(&event.event_type)
        .bind(&event_data)
        .bind(timestamp)
        .bind(&event.session_id)
        .bind(event.duration)
        .execute(pool)
        .await;

        match result {
            Ok(_) => processed += 1,
            Err(e) => {
                eprintln!("Error storing event for user {}: {}", user_id, e);
                failed += 1;
            }
        }
    }

    Ok(BatchEventResponse {
        success: failed == 0,
        processed,
        failed,
        message: format!("Processed {} events, {} failed", processed, failed),
    })
}

/// Get events for a specific user within a time range
#[allow(dead_code)]
pub async fn get_user_events(
    user_id: &str,
    limit: i64,
    pool: &Pool<Postgres>,
) -> Result<Vec<AnalyticsEvent>, String> {
    let rows = sqlx::query(
        r#"
        SELECT 
            id,
            user_id,
            event_type,
            data,
            timestamp,
            session_id,
            duration
        FROM analytics_events
        WHERE user_id = $1
        ORDER BY timestamp DESC
        LIMIT $2
        "#,
    )
    .bind(user_id)
    .bind(limit)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Error fetching events: {}", e))?;

    let events = rows
        .iter()
        .map(|row| AnalyticsEvent {
            id: row.try_get("id").ok(),
            user_id: row.get("user_id"),
            event_type: row.get("event_type"),
            data: row.get("data"),
            timestamp: row.get("timestamp"),
            session_id: row.try_get("session_id").ok(),
            duration: row.try_get("duration").ok(),
        })
        .collect();

    Ok(events)
}

/// Aggregate events by type for analytics
#[allow(dead_code)]
pub async fn aggregate_events_by_type(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<Vec<(String, i64)>, String> {
    let results = sqlx::query(
        r#"
        SELECT 
            event_type,
            COUNT(*) as count
        FROM analytics_events
        WHERE user_id = $1
        GROUP BY event_type
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Error aggregating events: {}", e))?;

    let aggregated = results
        .iter()
        .map(|row| {
            let event_type: String = row.get("event_type");
            let count: i64 = row.try_get("count").unwrap_or(0);
            (event_type, count)
        })
        .collect();

    Ok(aggregated)
}

/// Get event statistics for a user
#[allow(dead_code)]
pub async fn get_event_statistics(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<serde_json::Value, String> {
    let total_events: (i64,) =
        sqlx::query_as("SELECT COUNT(*) FROM analytics_events WHERE user_id = $1")
            .bind(user_id)
            .fetch_one(pool)
            .await
            .map_err(|e| format!("Error getting event count: {}", e))?;

    let event_types = aggregate_events_by_type(user_id, pool).await?;

    let recent_timestamp: Option<DateTime<Utc>> =
        sqlx::query_scalar("SELECT MAX(timestamp) FROM analytics_events WHERE user_id = $1")
            .bind(user_id)
            .fetch_optional(pool)
            .await
            .map_err(|e| format!("Error getting recent timestamp: {}", e))?
            .flatten();

    Ok(serde_json::json!({
        "total_events": total_events.0,
        "event_types": event_types,
        "last_event": recent_timestamp,
        "user_id": user_id
    }))
}
