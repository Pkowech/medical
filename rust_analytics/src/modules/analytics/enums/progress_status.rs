use serde::{Serialize, Deserialize};
use sqlx::FromRow;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, sqlx::Type)]
#[sqlx(type_name = "progress_status", rename_all = "snake_case")]
pub enum ProgressStatus {
	NotStarted,
	InProgress,
	Completed,
	Active,
	Skipped,
	Dropped,
	Reviewed,
}
