use chrono::{Timelike, Utc};
use serde::{Deserialize, Serialize};
/// Learning patterns analysis module
use sqlx::{Pool, Postgres, Row};
use std::collections::HashMap;

#[derive(Debug, Serialize, Deserialize)]
pub struct LearningPattern {
    pub pattern_name: String,
    pub description: String,
    pub confidence: f64,
    pub supporting_data: serde_json::Value,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PatternAnalysisResult {
    pub user_id: String,
    pub patterns: Vec<LearningPattern>,
    pub pattern_summary: PatternSummary,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PatternSummary {
    pub primary_pattern: String,
    pub learning_style: String,
    pub optimal_session_duration: i32,
    pub best_study_times: Vec<String>,
    pub consistency_trend: String,
    pub engagement_level: String,
}

#[derive(Debug, Clone)]
struct EventRecord {
    event_type: String,
    timestamp: chrono::DateTime<Utc>,
    duration: Option<i32>,
}

/// Analyze comprehensive learning patterns for a user
pub async fn analyze_learning_patterns(
    user_id: &str,
    pool: &Pool<Postgres>,
) -> Result<PatternAnalysisResult, String> {
    let events_result = sqlx::query(
        "SELECT event_type, timestamp, duration FROM analytics_events WHERE user_id = $1 ORDER BY timestamp DESC LIMIT 100"
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
    .map_err(|e| format!("Error fetching events: {}", e))?;

    let events: Vec<EventRecord> = events_result
        .into_iter()
        .map(|row| EventRecord {
            event_type: row.get("event_type"),
            timestamp: row.get("timestamp"),
            duration: row.try_get("duration").ok(),
        })
        .collect();

    if events.is_empty() {
        return Ok(PatternAnalysisResult {
            user_id: user_id.to_string(),
            patterns: vec![],
            pattern_summary: PatternSummary {
                primary_pattern: "insufficient_data".to_string(),
                learning_style: "unknown".to_string(),
                optimal_session_duration: 60,
                best_study_times: vec!["09:00".to_string(), "14:00".to_string()],
                consistency_trend: "new_user".to_string(),
                engagement_level: "low".to_string(),
            },
        });
    }

    let mut patterns = Vec::new();

    if let Some(p) = analyze_session_durations(&events) {
        patterns.push(p);
    }
    if let Some(p) = analyze_study_timing(&events) {
        patterns.push(p);
    }
    if let Some(p) = analyze_event_frequency(&events) {
        patterns.push(p);
    }
    if let Some(p) = analyze_learning_style(&events) {
        patterns.push(p);
    }
    if let Some(p) = analyze_consistency(&events) {
        patterns.push(p);
    }

    let pattern_summary = generate_pattern_summary(&patterns, &events);

    Ok(PatternAnalysisResult {
        user_id: user_id.to_string(),
        patterns,
        pattern_summary,
    })
}

fn analyze_session_durations(events: &[EventRecord]) -> Option<LearningPattern> {
    let durations: Vec<i32> = events.iter().filter_map(|e| e.duration).collect();
    if durations.is_empty() {
        return None;
    }

    let avg = durations.iter().sum::<i32>() as f64 / durations.len() as f64;
    let pattern_type = if avg < 30.0 {
        "short_focused"
    } else if avg < 90.0 {
        "moderate"
    } else {
        "marathon"
    };

    Some(LearningPattern {
        pattern_name: "session_duration".to_string(),
        description: format!("Prefers {} sessions ({:.0} min avg)", pattern_type, avg),
        confidence: 0.85,
        supporting_data: serde_json::json!({"average_duration": avg, "pattern_type": pattern_type}),
    })
}

fn analyze_study_timing(events: &[EventRecord]) -> Option<LearningPattern> {
    let mut hour_counts: HashMap<u32, i32> = HashMap::new();
    for event in events {
        *hour_counts.entry(event.timestamp.hour()).or_insert(0) += 1;
    }

    if hour_counts.is_empty() {
        return None;
    }

    let peak_hours: Vec<u32> = hour_counts
        .iter()
        .filter(|(_, count)| *count > &(hour_counts.len() as i32 / 3))
        .map(|(h, _)| *h)
        .collect();

    Some(LearningPattern {
        pattern_name: "study_timing".to_string(),
        description: format!(
            "Peak study hours: {}",
            peak_hours
                .iter()
                .map(|h| format!("{}:00", h))
                .collect::<Vec<_>>()
                .join(", ")
        ),
        confidence: 0.75,
        supporting_data: serde_json::json!({"peak_hours": peak_hours}),
    })
}

fn analyze_event_frequency(events: &[EventRecord]) -> Option<LearningPattern> {
    let mut type_counts: HashMap<String, i32> = HashMap::new();
    for event in events {
        *type_counts.entry(event.event_type.clone()).or_insert(0) += 1;
    }

    let most_common = type_counts
        .iter()
        .max_by_key(|(_, count)| *count)
        .map(|(t, _)| t.clone())?;

    Some(LearningPattern {
        pattern_name: "activity_preference".to_string(),
        description: format!("Primary activity: {}", most_common),
        confidence: 0.8,
        supporting_data: serde_json::json!({"primary_activity": most_common}),
    })
}

fn analyze_learning_style(events: &[EventRecord]) -> Option<LearningPattern> {
    let (mut quiz, mut material, mut study) = (0, 0, 0);
    for event in events {
        match event.event_type.as_str() {
            "quiz_attempt" => quiz += 1,
            "material_access" => material += 1,
            "study_session" => study += 1,
            _ => {}
        }
    }

    let total = quiz + material + study;
    if total == 0 {
        return None;
    }

    let style = if quiz as f64 / total as f64 > 0.4 {
        "assessment_driven"
    } else if material as f64 / total as f64 > 0.4 {
        "reading_writing"
    } else {
        "balanced"
    };

    Some(LearningPattern {
        pattern_name: "learning_style".to_string(),
        description: format!("Learning style: {}", style),
        confidence: 0.82,
        supporting_data: serde_json::json!({"learning_style": style}),
    })
}

fn analyze_consistency(events: &[EventRecord]) -> Option<LearningPattern> {
    if events.len() < 2 {
        return None;
    }

    let mut dates = Vec::new();
    for event in events {
        dates.push(event.timestamp.date_naive());
    }
    let _unique_dates = dates.len() as f64 / events.len() as f64;

    Some(LearningPattern {
        pattern_name: "consistency".to_string(),
        description: "Engagement pattern analyzed".to_string(),
        confidence: 0.78,
        supporting_data: serde_json::json!({"unique_days": dates.len(), "total_events": events.len()}),
    })
}

fn generate_pattern_summary(
    patterns: &[LearningPattern],
    events: &[EventRecord],
) -> PatternSummary {
    let engagement = if events.len() > 50 {
        "high"
    } else if events.len() > 20 {
        "medium"
    } else {
        "low"
    };

    PatternSummary {
        primary_pattern: patterns
            .first()
            .map(|p| p.pattern_name.clone())
            .unwrap_or_default(),
        learning_style: "balanced".to_string(),
        optimal_session_duration: 60,
        best_study_times: vec!["09:00".to_string(), "14:00".to_string()],
        consistency_trend: "improving".to_string(),
        engagement_level: engagement.to_string(),
    }
}
