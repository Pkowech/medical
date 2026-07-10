pub mod engagement {
    #[derive(Debug, Clone)]
    pub struct GetEngagementMetricsRequest {
        pub user_id: String,
    }

    #[derive(Debug, Clone)]
    pub struct GetEngagementMetricsResponse {
        pub time_spent: f32,
        pub completion_rate: f32,
        pub activity_frequency: i32,
        pub daily_streak: i32,
        pub weekly_streak: i32,
    }
}

pub mod course_progress {
    #[derive(Debug, Clone)]
    pub struct GetCourseProgressRequest {
        pub user_id: String,
    }

    #[derive(Debug, Clone)]
    pub struct GetCourseProgressResponse {
        pub total_courses: i32,
        pub completed_courses: i32,
        pub completion_rate: f32,
    }
}

pub mod path_analytics {
    #[derive(Debug, Clone)]
    pub struct GetPathAnalyticsRequest {
        pub user_id: String,
    }

    #[derive(Debug, Clone)]
    pub struct GetPathAnalyticsResponse {
        pub total_paths: i32,
        pub completed_paths: i32,
        pub completion_rate: f32,
    }
}

pub mod goals {
    use chrono::NaiveDate;
    use crate::domain::models::Goal;

    #[derive(Debug, Clone)]
    pub struct GoalsRequest {
        pub user_id: String,
        pub status: Option<String>,
    }

    #[derive(Debug, Clone)]
    pub struct UpcomingDeadline {
        pub goal_id: String,
        pub title: String,
        pub target_date: NaiveDate,
        pub days_remaining: i32,
    }

    #[derive(Debug, Clone)]
    pub struct GoalResponse {
        pub id: String,
        pub user_id: String,
        pub title: String,
        pub status: crate::domain::value_objects::ProgressStatus,
        pub category: String,
        pub priority: String,
        pub target_date: Option<NaiveDate>,
        pub completed_at: Option<chrono::NaiveDateTime>,
        pub streak_count: i32,
    }

    #[derive(Debug, Clone)]
    pub struct GoalsResponse {
        pub user_id: String,
        pub goals: Vec<Goal>,
        pub upcoming_deadlines: Vec<UpcomingDeadline>,
        pub total_goals: i32,
    }

    #[derive(Debug, Clone)]
    pub struct UpdateGoalRequest {
        pub user_id: String,
        pub goal_id: String,
        pub status: Option<crate::domain::value_objects::ProgressStatus>,
        pub priority: Option<String>,
        pub target_date: Option<NaiveDate>,
        pub streak_count: Option<i32>,
    }
}
