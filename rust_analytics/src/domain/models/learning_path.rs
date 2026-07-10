use chrono::NaiveDateTime;
use crate::domain::value_objects::ProgressStatus;

#[derive(Debug, Clone, PartialEq)]
pub struct LearningPath {
	pub id: String,
	pub name: String,
	pub title: String,
	pub description: Option<String>,
	pub difficulty: Option<String>,
	pub estimated_time_hours: Option<i32>,
	pub tags: Option<Vec<String>>,
	pub total_phases: i32,
	pub created_at: NaiveDateTime,
	pub progress: Option<f32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PathProgress {
	pub user_id: String,
	pub path_id: String,
	pub status: ProgressStatus,
	pub total_time_spent_minutes: i32,
	pub overall_progress_percentage: f32,
	pub last_activity_date: NaiveDateTime,
	pub category_id: Option<String>,
	pub phase_progress: Option<PhaseProgress>,
	pub current_unit_id: Option<String>,
	pub completed_units_count: Option<i32>,
	pub progress_percentage: Option<f32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PathUnit {
	pub id: String,
	pub path_id: String,
	pub title: String,
	pub order_index: i32,
	pub unit_type: Option<String>,
	pub unit_reference_id: Option<String>,
	pub description: Option<String>,
	pub order: Option<i32>,
}

#[derive(Debug, Clone, PartialEq)]
pub struct RecommendedPath {
	pub id: String,
	pub path_id: String,
	pub name: String,
	pub title: String,
	pub description: Option<String>,
	pub difficulty: Option<String>,
	pub estimated_time_hours: Option<i32>,
	pub tags: Option<Vec<String>>,
	pub recommended_score: f32,
	pub score: Option<f32>,
	pub reason: String,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LearningPathProgress {
	pub user_id: String,
	pub path_id: String,
	pub status: ProgressStatus,
	pub total_time_spent_minutes: i32,
	pub overall_progress_percentage: f32,
	pub last_activity_date: NaiveDateTime,
	pub category_id: Option<String>,
	pub phase_progress: Option<PhaseProgress>,
}

#[derive(Debug, Clone)]
pub struct LearningPathStatsResult {
	pub total_learning_paths: usize,
	pub completed_learning_paths: usize,
	pub total_study_time_minutes: i32,
	pub average_path_progress: f32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct PhaseProgress {
	pub phase_id: String,
	pub title: String,
}
