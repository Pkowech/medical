use super::*;
use chrono::NaiveDateTime;

impl super::MyAnalyticsService {
    pub async fn calculate_course_progress_internal(
        &self,
        user_id: String,
        course_id: String,
    ) -> Result<crate::analytics_proto::CourseProgress, tonic::Status> {
        if course_id.is_empty() {
            return Err(tonic::Status::invalid_argument("course_id cannot be empty"));
        }

        // 1. Get all unit IDs for the course
        let units: Vec<(String,)> = sqlx::query_as("SELECT id FROM units WHERE course_id = $1")
            .bind(&course_id)
            .fetch_all(&self.pool)
            .await
            .map_err(|e| tonic::Status::internal(format!("DB error fetching units: {}", e)))?;

        if units.is_empty() {
            // Return a default/empty CourseProgress if the course has no units
            return Ok(crate::analytics_proto::CourseProgress {
                id: uuid::Uuid::new_v4().to_string(),
                user_id,
                course_id,
                ..Default::default()
            });
        }

        let mut unit_completion_status = Vec::new();
        let mut total_time_spent: i32 = 0;
        let mut last_accessed_dates: Vec<NaiveDateTime> = Vec::new();

        // 2. Calculate progress for each unit
        for (unit_id,) in units.iter() {
            let total_materials: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM materials WHERE unit_id = $1")
                .bind(unit_id)
                .fetch_one(&self.pool)
                .await
                .unwrap_or(0);

            let completed_materials: i64 = if total_materials > 0 {
                sqlx::query_scalar("SELECT COUNT(*) FROM material_progress mp JOIN materials m ON mp.material_id = m.id WHERE mp.user_id = $1 AND m.unit_id = $2 AND mp.is_completed = true")
                    .bind(&user_id)
                    .bind(unit_id)
                    .fetch_one(&self.pool)
                    .await
                    .unwrap_or(0)
            } else {
                0
            };

            let unit_progress_percentage = if total_materials > 0 {
                (completed_materials as f32 / total_materials as f32) * 100.0
            } else {
                100.0 // A unit with no materials is considered complete
            };
            unit_completion_status.push(unit_progress_percentage >= 100.0);

            if let Some(access_info) = sqlx::query_as::<_, (Option<i32>, Option<NaiveDateTime>)>("SELECT SUM(time_spent), MAX(accessed_at) FROM unit_access WHERE user_id = $1 AND unit_id = $2")
                .bind(&user_id)
                .bind(unit_id)
                .fetch_optional(&self.pool)
                .await
                .map_err(|e| tonic::Status::internal(format!("DB error fetching unit access: {}", e)))? {
                    if let Some(time) = access_info.0 {
                        total_time_spent += time;
                    }
                    if let Some(date) = access_info.1 {
                        last_accessed_dates.push(date);
                    }
            }
        }

        // 3. Aggregate the results
        let completed_units = unit_completion_status.iter().filter(|&&is_completed| is_completed).count() as i32;
        let total_units = units.len() as i32;
        let final_progress_percentage = if total_units > 0 {
            (completed_units as f32 / total_units as f32) * 100.0
        } else {
            100.0 // A course with no units is considered complete
        };
        
        let last_accessed = last_accessed_dates.iter().max().cloned();

        let final_status = if final_progress_percentage >= 100.0 {
            3 // COMPLETED
        } else if final_progress_percentage > 0.0 {
            2 // IN_PROGRESS
        } else {
            1 // NOT_STARTED
        };

        // 4. Construct and return the CourseProgress object
        let result = crate::analytics_proto::CourseProgress {
            id: uuid::Uuid::new_v4().to_string(),
            user_id,
            course_id,
            status: final_status,
            time_spent: total_time_spent,
            progress_percentage: final_progress_percentage as i32,
            completed_units,
            total_units,
            started_at: None,
            completed_at: None,
            last_accessed_at: last_accessed.map(|dt| prost_types::Timestamp {
                seconds: chrono::Utc.from_utc_datetime(&dt).timestamp(),
                nanos: chrono::Utc.from_utc_datetime(&dt).timestamp_subsec_nanos() as i32,
            }),
            created_at: None,
            updated_at: None,
        };
        
        Ok(result)
    }
}
