use serde::{Deserialize, Serialize};
use std::fmt;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type, Default)]
#[sqlx(type_name = "progress_status", rename_all = "snake_case")]
pub enum ProgressStatus {
    #[default]
    NotStarted,
    InProgress,
    Completed,
    Active,
    Skipped,
    Dropped,
    Reviewed,
}

impl fmt::Display for ProgressStatus {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        let s = match self {
            ProgressStatus::NotStarted => "not_started",
            ProgressStatus::InProgress => "in_progress",
            ProgressStatus::Completed => "completed",
            ProgressStatus::Active => "active",
            ProgressStatus::Skipped => "skipped",
            ProgressStatus::Dropped => "dropped",
            ProgressStatus::Reviewed => "reviewed",
        };
        write!(f, "{}", s)
    }
}
