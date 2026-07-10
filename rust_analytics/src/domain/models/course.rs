use crate::domain::value_objects::ProgressStatus;
use chrono::NaiveDateTime;
use serde::{Deserialize, Serialize};
use sqlx::FromRow;

#[derive(Debug, Clone, PartialEq, FromRow, Serialize, Deserialize)]
pub struct CourseProgress {
    #[sqlx(rename = "id")]
    pub id: String,
    #[sqlx(rename = "user_id")]
    pub user_id: String,
    #[sqlx(rename = "course_id")]
    pub course_id: String,
    pub status: ProgressStatus,
    #[sqlx(rename = "time_spent")]
    pub time_spent: i32,
    #[sqlx(rename = "progress_percentage")]
    pub progress_percentage: i32,
    #[sqlx(rename = "completed_units")]
    pub completed_units: i32,
    pub total_units: i32,
    #[sqlx(rename = "started_at")]
    pub started_at: Option<NaiveDateTime>,
    #[sqlx(rename = "completed_at")]
    pub completed_at: Option<NaiveDateTime>,
    #[sqlx(rename = "last_accessed_at")]
    pub last_accessed_at: NaiveDateTime,
    #[sqlx(rename = "created_at")]
    pub created_at: NaiveDateTime,
    #[sqlx(rename = "updated_at")]
    pub updated_at: NaiveDateTime,
}

#[derive(Debug, Clone)]
pub struct CourseStatsResult {
    pub total_courses: usize,
    pub completed_courses: usize,
    pub total_study_time_minutes: i32,
    pub average_course_progress: f32,
}

#[derive(Debug, Clone, PartialEq, FromRow, Serialize, Deserialize)]
pub struct UnitProgress {
    #[sqlx(rename = "id")]
    pub id: String,
    #[sqlx(rename = "user_id")]
    pub user_id: String,
    #[sqlx(rename = "unit_id")]
    pub unit_id: String,
    pub status: ProgressStatus,
    #[sqlx(rename = "time_spent")]
    pub time_spent: i32,
    #[sqlx(rename = "progress_percentage")]
    pub progress_percentage: i32,
    #[sqlx(rename = "concurrent_slot_number")]
    pub concurrent_slot_number: Option<i32>,
    #[sqlx(rename = "created_at")]
    pub created_at: NaiveDateTime,
    #[sqlx(rename = "updated_at")]
    pub updated_at: NaiveDateTime,
}
