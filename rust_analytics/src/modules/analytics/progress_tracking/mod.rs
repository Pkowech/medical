// Progress Tracking Analytics
// CourseProgress, UnitProgress, TopicProgress
// Tracks completion percentages, time spent, status

use chrono::{NaiveDateTime, TimeZone, Utc};
use sqlx::{Pool, Postgres};

use crate::analytics_proto::{CourseProgress, ProgressStatus};

pub async fn calculate_user_course_progress(
    pool: &Pool<Postgres>,
    user_id: &str,
) -> Result<Vec<(String, i32)>, sqlx::Error> {
    sqlx::query_as(
        r#"
        WITH enrolled_courses AS (
            SELECT DISTINCT course_id
            FROM course_enrollments
            WHERE user_id = $1
              AND status::text NOT IN ('dropped', 'DROPPED')
        ),
        unit_progress AS (
            SELECT
                enrolled.course_id,
                unit.id AS unit_id,
                COALESCE(unit_state.is_completed, false) AS explicitly_completed,
                COALESCE(unit_state.progress_percentage, 0)::float8 AS unit_percentage,
                COUNT(DISTINCT topic.id)::bigint AS total_topics,
                COUNT(DISTINCT topic.id) FILTER (
                    WHERE COALESCE(topic_state.is_completed, false)
                )::bigint AS completed_topics,
                COALESCE(AVG(
                    CASE
                        WHEN topic.id IS NULL THEN NULL
                        WHEN COALESCE(topic_state.is_completed, false) THEN 100
                        ELSE COALESCE(topic_state.progress_percentage, 0)
                    END
                ), 0)::float8 AS topic_percentage
            FROM enrolled_courses enrolled
            JOIN units unit ON unit.course_id = enrolled.course_id
            LEFT JOIN topics topic ON topic.unit_id = unit.id
                AND topic.status::text = 'published'
                AND (
                    NOT EXISTS (
                        SELECT 1
                        FROM topics mandatory
                        WHERE mandatory.unit_id = unit.id
                          AND mandatory.status::text = 'published'
                          AND mandatory.is_mandatory = true
                    )
                    OR topic.is_mandatory = true
                )
            LEFT JOIN LATERAL (
                SELECT
                    BOOL_OR(
                        progress.is_completed = true
                        OR progress.status::text IN ('completed', 'COMPLETED')
                    ) AS is_completed,
                    MAX(progress.progress_percentage) AS progress_percentage
                FROM topic_progress progress
                WHERE progress.topic_id = topic.id
                  AND progress.user_id = $1
                  AND progress.material_id IS NULL
            ) topic_state ON true
            LEFT JOIN LATERAL (
                SELECT
                    BOOL_OR(
                        progress.is_completed = true
                        OR progress.status::text IN ('completed', 'COMPLETED')
                    ) AS is_completed,
                    MAX(progress.progress_percentage) AS progress_percentage
                FROM topic_progress progress
                WHERE progress.unit_id = unit.id
                  AND progress.user_id = $1
                  AND progress.topic_id IS NULL
                  AND progress.material_id IS NULL
            ) unit_state ON true
            GROUP BY
                enrolled.course_id,
                unit.id,
                unit_state.is_completed,
                unit_state.progress_percentage
        )
        SELECT
            enrolled.course_id,
            COALESCE(ROUND(AVG(
                CASE
                    WHEN unit.unit_id IS NULL THEN NULL
                    WHEN unit.explicitly_completed
                      OR (
                          unit.total_topics > 0
                          AND unit.completed_topics = unit.total_topics
                      ) THEN 100
                    WHEN unit.total_topics > 0 THEN unit.topic_percentage
                    ELSE unit.unit_percentage
                END
            )), 0)::int AS progress_percentage
        FROM enrolled_courses enrolled
        LEFT JOIN unit_progress unit ON unit.course_id = enrolled.course_id
        GROUP BY enrolled.course_id
        ORDER BY enrolled.course_id
        "#,
    )
    .bind(user_id)
    .fetch_all(pool)
    .await
}

pub fn summarize_user_course_progress(progress: &[(String, i32)]) -> (i32, i32, f32) {
    let total = progress.len().min(i32::MAX as usize) as i32;
    let completed = progress
        .iter()
        .filter(|(_, percentage)| *percentage >= 100)
        .count()
        .min(i32::MAX as usize) as i32;
    let average = if progress.is_empty() {
        0.0
    } else {
        progress
            .iter()
            .map(|(_, percentage)| *percentage as f32)
            .sum::<f32>()
            / progress.len() as f32
    };
    (total, completed, average)
}

pub async fn calculate_course_progress(
    pool: &Pool<Postgres>,
    user_id: &str,
    course_id: &str,
) -> Result<CourseProgress, sqlx::Error> {
    let unit_progress: Vec<(i64, i64, bool, f64, f64)> = sqlx::query_as(
        r#"
		SELECT
			COUNT(DISTINCT t.id),
			COUNT(DISTINCT t.id) FILTER (
				WHERE COALESCE(tp.is_completed, false)
			),
			COALESCE(unit_progress.is_completed, false),
			COALESCE(AVG(
				CASE
					WHEN t.id IS NULL THEN NULL
					WHEN COALESCE(tp.is_completed, false) THEN 100
					ELSE COALESCE(tp.progress_percentage, 0)
				END
			), 0)::float8,
			COALESCE(unit_progress.progress_percentage, 0)::float8
		FROM units u
		LEFT JOIN topics t ON t.unit_id = u.id
			AND t.status::text = 'published'
			AND (
				NOT EXISTS (
					SELECT 1 FROM topics mandatory
					WHERE mandatory.unit_id = u.id
						AND mandatory.status::text = 'published'
						AND mandatory.is_mandatory = true
				)
				OR t.is_mandatory = true
			)
		LEFT JOIN LATERAL (
			SELECT
				BOOL_OR(p.is_completed = true OR p.status = 'completed') AS is_completed,
				MAX(p.progress_percentage) AS progress_percentage
			FROM topic_progress p
			WHERE p.topic_id = t.id
				AND p.user_id = $1
				AND p.material_id IS NULL
		) tp ON true
		LEFT JOIN LATERAL (
			SELECT
				BOOL_OR(p.is_completed = true OR p.status::text = 'completed') AS is_completed,
				MAX(p.progress_percentage) AS progress_percentage
			FROM topic_progress p
			WHERE p.unit_id = u.id
				AND p.user_id = $1
				AND p.topic_id IS NULL
				AND p.material_id IS NULL
		) unit_progress ON true
		WHERE u.course_id = $2
		GROUP BY u.id, unit_progress.is_completed, unit_progress.progress_percentage
		"#,
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_all(pool)
    .await?;

    let (time_spent, last_accessed): (Option<i64>, Option<NaiveDateTime>) = sqlx::query_as(
        r#"
		SELECT COALESCE(SUM(ss.duration), 0), MAX(ss.end_time)
		FROM study_sessions ss
		LEFT JOIN topics t ON t.id = ss.topic_id
		LEFT JOIN materials m ON m.id = ss.material_id
		JOIN units u ON u.id = COALESCE(t.unit_id, m.unit_id)
		WHERE ss.user_id = $1
			AND u.course_id = $2
			AND ss.is_valid = true
			AND ss.end_time IS NOT NULL
		"#,
    )
    .bind(user_id)
    .bind(course_id)
    .fetch_one(pool)
    .await?;

    Ok(build_course_progress(
        user_id,
        course_id,
        &unit_progress,
        time_spent.unwrap_or_default(),
        last_accessed,
    ))
}

fn build_course_progress(
    user_id: &str,
    course_id: &str,
    unit_progress: &[(i64, i64, bool, f64, f64)],
    time_spent: i64,
    last_accessed: Option<NaiveDateTime>,
) -> CourseProgress {
    let total_units = unit_progress.len() as i32;
    let completed_units = unit_progress
        .iter()
        .filter(
            |(total_topics, completed_topics, explicitly_completed, _, _)| {
                *explicitly_completed || (*total_topics > 0 && total_topics == completed_topics)
            },
        )
        .count() as i32;
    let progress_percentage = if total_units == 0 {
        0
    } else {
        let total_percentage: f64 = unit_progress
            .iter()
            .map(
                |(total_topics, _, explicitly_completed, topic_percentage, unit_percentage)| {
                    if *explicitly_completed {
                        100.0
                    } else if *total_topics > 0 {
                        topic_percentage.clamp(0.0, 100.0)
                    } else {
                        unit_percentage.clamp(0.0, 100.0)
                    }
                },
            )
            .sum();
        (total_percentage / total_units as f64).round() as i32
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
    use super::{build_course_progress, summarize_user_course_progress, ProgressStatus};
    use serde_json::Value;
    use std::collections::HashMap;

    #[test]
    fn aggregates_topic_completion_and_unit_progress() {
        let progress = build_course_progress(
            "user-1",
            "course-1",
            &[(2, 2, false, 100.0, 0.0), (3, 1, false, 40.0, 0.0)],
            42,
            None,
        );

        assert_eq!(progress.progress_percentage, 70);
        assert_eq!(progress.completed_units, 1);
        assert_eq!(progress.total_units, 2);
        assert_eq!(progress.status, ProgressStatus::InProgress as i32);
        assert_eq!(progress.time_spent, 42);
    }

    #[test]
    fn includes_explicit_unit_completion_and_leaves_empty_units_incomplete() {
        let completed_unit =
            build_course_progress("user-1", "course-1", &[(0, 0, true, 0.0, 0.0)], 0, None);
        assert_eq!(completed_unit.progress_percentage, 100);
        assert_eq!(completed_unit.completed_units, 1);

        let empty_unit =
            build_course_progress("user-1", "course-1", &[(0, 0, false, 0.0, 0.0)], 0, None);
        assert_eq!(empty_unit.progress_percentage, 0);
        assert_eq!(empty_unit.completed_units, 0);

        let empty_course = build_course_progress("user-1", "course-1", &[], 0, None);
        assert_eq!(empty_course.progress_percentage, 0);
        assert_eq!(empty_course.status, ProgressStatus::NotStarted as i32);
    }

    #[test]
    fn uses_unit_progress_for_empty_units_to_match_nestjs_aggregation() {
        let progress =
            build_course_progress("user-1", "course-1", &[(0, 0, false, 0.0, 35.0)], 0, None);

        assert_eq!(progress.progress_percentage, 35);
        assert_eq!(progress.completed_units, 0);
        assert_eq!(progress.status, ProgressStatus::InProgress as i32);
    }

    #[test]
    fn aggregates_partial_topic_progress_into_course_progress() {
        let progress = build_course_progress(
            "user-1",
            "course-1",
            &[(4, 1, false, 25.0, 0.0), (2, 0, false, 0.0, 0.0)],
            0,
            None,
        );

        assert_eq!(progress.progress_percentage, 13);
        assert_eq!(progress.completed_units, 0);
        assert_eq!(progress.total_units, 2);
    }

    #[test]
    fn matches_the_shared_published_mandatory_and_empty_unit_history() {
        let fixture: Value = serde_json::from_str(include_str!(
            "../../../../../shared_fixtures/course-progress-history.json"
        ))
        .expect("shared course progress fixture must be valid JSON");
        let topic_progress: HashMap<&str, &Value> = fixture["topicProgress"]
            .as_array()
            .expect("topic progress rows")
            .iter()
            .map(|progress| (progress["topicId"].as_str().expect("topic id"), progress))
            .collect();
        let unit_progress: HashMap<&str, &Value> = fixture["unitProgress"]
            .as_array()
            .expect("unit progress rows")
            .iter()
            .map(|progress| (progress["unitId"].as_str().expect("unit id"), progress))
            .collect();

        let rows: Vec<(i64, i64, bool, f64, f64)> = fixture["units"]
            .as_array()
            .expect("units")
            .iter()
            .map(|unit| {
                let published_topics: Vec<&Value> = unit["topics"]
                    .as_array()
                    .expect("unit topics")
                    .iter()
                    .filter(|topic| topic["status"] == "published")
                    .collect();
                let mandatory_topics: Vec<&Value> = published_topics
                    .iter()
                    .copied()
                    .filter(|topic| topic["isMandatory"] == true)
                    .collect();
                let required_topics = if mandatory_topics.is_empty() {
                    published_topics
                } else {
                    mandatory_topics
                };
                let topic_percentages: Vec<f64> = required_topics
                    .iter()
                    .map(|topic| {
                        let progress = topic_progress
                            .get(topic["id"].as_str().expect("topic id"))
                            .copied();
                        let completed = progress.is_some_and(|row| {
                            row["isCompleted"] == true || row["status"] == "completed"
                        });
                        if completed {
                            100.0
                        } else {
                            progress
                                .and_then(|row| row["progressPercentage"].as_f64())
                                .unwrap_or(0.0)
                        }
                    })
                    .collect();
                let completed_topics = required_topics
                    .iter()
                    .filter(|topic| {
                        topic_progress
                            .get(topic["id"].as_str().expect("topic id"))
                            .is_some_and(|row| {
                                row["isCompleted"] == true || row["status"] == "completed"
                            })
                    })
                    .count() as i64;
                let topic_percentage = if topic_percentages.is_empty() {
                    0.0
                } else {
                    topic_percentages.iter().sum::<f64>() / topic_percentages.len() as f64
                };
                let unit_state = unit_progress
                    .get(unit["id"].as_str().expect("unit id"))
                    .copied();
                let unit_completed = unit_state
                    .is_some_and(|row| row["isCompleted"] == true || row["status"] == "completed");
                let unit_percentage = unit_state
                    .and_then(|row| row["progressPercentage"].as_f64())
                    .unwrap_or(0.0);
                (
                    required_topics.len() as i64,
                    completed_topics,
                    unit_completed,
                    topic_percentage,
                    unit_percentage,
                )
            })
            .collect();

        let progress = build_course_progress(
            fixture["userId"].as_str().expect("user id"),
            fixture["courseId"].as_str().expect("course id"),
            &rows,
            0,
            None,
        );
        assert_eq!(
            progress.progress_percentage,
            fixture["expected"]["percentage"].as_i64().unwrap() as i32
        );
        assert_eq!(
            progress.completed_units,
            fixture["expected"]["completedUnits"].as_i64().unwrap() as i32
        );
        assert_eq!(
            progress.total_units,
            fixture["expected"]["totalUnits"].as_i64().unwrap() as i32
        );
        assert_eq!(
            progress.status,
            ProgressStatus::InProgress as i32,
            "course progress status must match the shared fixture"
        );
    }

    #[test]
    fn summarizes_course_progress_without_enrollment_snapshots() {
        let progress = vec![
            ("course-1".to_string(), 100),
            ("course-2".to_string(), 60),
            ("course-3".to_string(), 0),
        ];
        assert_eq!(
            summarize_user_course_progress(&progress),
            (3, 1, 160.0 / 3.0)
        );
    }
}
