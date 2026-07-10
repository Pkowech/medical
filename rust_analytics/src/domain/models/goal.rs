use chrono::{NaiveDate, NaiveDateTime};
use std::collections::HashMap;
use crate::domain::value_objects::ProgressStatus;

#[derive(Debug, Clone, PartialEq)]
pub struct Goal {
	pub id: String,
	pub user_id: String,
	pub title: String,
	pub status: ProgressStatus,
	pub category: String,
	pub priority: String,
	pub target_date: Option<NaiveDate>,
	pub completed_at: Option<NaiveDateTime>,
	pub created_at: NaiveDateTime,
	pub start_date: Option<NaiveDateTime>,
	pub streak_count: i32,
}

#[derive(Debug, Clone, PartialEq)]
pub struct LearningGoalProgress {
	pub user_id: String,
	pub goal_id: String,
	pub progress_percentage: f32,
	pub recorded_at: NaiveDateTime,
	pub metadata: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct GoalAnalyticsResult {
	pub total_goals: usize,
	pub active_goals: usize,
	pub completed_goals: usize,
	pub overdue_goals: usize,
	pub completion_rate: f32,
	pub average_completion_time_days: f32,
	pub goals_by_category: HashMap<String, usize>,
	pub goals_by_priority: HashMap<String, usize>,
	pub current_streak: i32,
	pub longest_streak: i32,
	pub streak_goal_ids: Vec<String>,
	pub upcoming_deadlines: Vec<UpcomingDeadline>,
}

#[derive(Debug, Clone)]
pub struct UpcomingDeadline {
	pub goal_id: String,
	pub title: String,
	pub target_date: NaiveDate,
	pub days_remaining: i32,
}
