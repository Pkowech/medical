// Progress Tracking Analytics
// CourseProgress, UnitProgress, TopicProgress
// Tracks completion percentages, time spent, status

use chrono::{NaiveDateTime, TimeZone, Utc};
use sqlx::{Pool, Postgres};

use crate::analytics_proto::{CourseProgress, ProgressStatus};

pub async fn calculate_course_progress(
	pool: &Pool<Postgres>,
	user_id: &str,
	course_id: &str,
) -> Result<CourseProgress, sqlx::Error> {
	let unit_material_counts: Vec<(i64, i64)> = sqlx::query_as(
		r#"
		SELECT COUNT(DISTINCT m.id), COUNT(DISTINCT tp.material_id)
		FROM units u
		LEFT JOIN materials m ON m.unit_id = u.id
		LEFT JOIN topic_progress tp
			ON tp.material_id = m.id
			AND tp.user_id = $1
			AND tp.is_completed = true
		WHERE u.course_id = $2
		GROUP BY u.id
		"#,
	)
	.bind(user_id)
	.bind(course_id)
	.fetch_all(pool)
	.await?;

	let (time_spent, last_accessed): (Option<i64>, Option<NaiveDateTime>) = sqlx::query_as(
		r#"
		SELECT COALESCE(SUM(ua.time_spent), 0), MAX(ua.accessed_at)
		FROM unit_accesses ua
		JOIN units u ON u.id = ua.unit_id
		WHERE ua.user_id = $1 AND u.course_id = $2
		"#,
	)
	.bind(user_id)
	.bind(course_id)
	.fetch_one(pool)
	.await?;

	Ok(build_course_progress(
		user_id,
		course_id,
		&unit_material_counts,
		time_spent.unwrap_or_default(),
		last_accessed,
	))
}

fn build_course_progress(
	user_id: &str,
	course_id: &str,
	unit_material_counts: &[(i64, i64)],
	time_spent: i64,
	last_accessed: Option<NaiveDateTime>,
) -> CourseProgress {
	let total_units = unit_material_counts.len() as i32;
	let completed_units = unit_material_counts
		.iter()
		.filter(|(total_materials, completed_materials)| {
			total_materials == completed_materials
		})
		.count() as i32;
	let progress_percentage = if total_units == 0 {
		0
	} else {
		((completed_units as f64 / total_units as f64) * 100.0).round() as i32
	};
	let status = if total_units == 0 || progress_percentage == 0 {
		ProgressStatus::NotStarted
	} else if progress_percentage == 100 {
		ProgressStatus::Completed
	} else {
		ProgressStatus::InProgress
	};
	let last_accessed_at = last_accessed.map(|datetime| {
		let timestamp = Utc.from_utc_datetime(&datetime);
		prost_types::Timestamp {
			seconds: timestamp.timestamp(),
			nanos: timestamp.timestamp_subsec_nanos() as i32,
		}
	});

	CourseProgress {
		id: uuid::Uuid::new_v4().to_string(),
		user_id: user_id.to_owned(),
		course_id: course_id.to_owned(),
		progress_percentage,
		status: status as i32,
		last_accessed_at,
			time_spent: time_spent.min(i32::MAX as i64) as i32,
		completed_units,
		total_units,
		started_at: None,
		completed_at: None,
		created_at: None,
		updated_at: None,
	}
}

#[cfg(test)]
mod tests {
	use super::{build_course_progress, ProgressStatus};

	#[test]
	fn aggregates_material_completion_per_unit() {
		let progress = build_course_progress(
			"user-1",
			"course-1",
			&[(2, 2), (3, 1)],
			42,
			None,
		);

		assert_eq!(progress.progress_percentage, 50);
		assert_eq!(progress.completed_units, 1);
		assert_eq!(progress.total_units, 2);
		assert_eq!(progress.status, ProgressStatus::InProgress as i32);
		assert_eq!(progress.time_spent, 42);
	}

	#[test]
	fn treats_units_without_materials_as_complete_but_empty_courses_as_not_started() {
		let empty_unit = build_course_progress("user-1", "course-1", &[(0, 0)], 0, None);
		assert_eq!(empty_unit.progress_percentage, 100);
		assert_eq!(empty_unit.status, ProgressStatus::Completed as i32);

		let empty_course = build_course_progress("user-1", "course-1", &[], 0, None);
		assert_eq!(empty_course.progress_percentage, 0);
		assert_eq!(empty_course.status, ProgressStatus::NotStarted as i32);
	}
}
