/// Goal-related use cases
/// Manages learning goals and milestones

pub mod get_goals_use_case;
pub mod update_goal_use_case;

// Re-export use cases
pub use get_goals_use_case::GetGoalsUseCase;
pub use update_goal_use_case::UpdateGoalUseCase;
