use polars::prelude::*;
use polars::lazy::dsl::col;
use sqlx::{Error, Pool, Postgres};

// Define the data structures for the query results
#[derive(sqlx::FromRow, Debug)]
pub struct UserProgress {
    pub course_id: i32,
    pub module_id: i32,
    pub progress: f32,
}

#[derive(sqlx::FromRow, Debug)]
pub struct UserQuiz {
    pub quiz_id: i32,
    pub score: f32,
    pub attempts: i32,
}

#[derive(sqlx::FromRow, Debug)]
pub struct UserStudyTime {
    pub date: chrono::NaiveDate,
    pub minutes: i32,
}

pub async fn get_user_data(
    pool: &Pool<Postgres>,
    user_id: &str,
) -> Result<(DataFrame, DataFrame, DataFrame), Error> {
    let progress_query = sqlx::query_as::<_, UserProgress>(
        "SELECT course_id, module_id, progress FROM user_progress WHERE user_id = $1",
    );
    let quizzes_query = sqlx::query_as::<_, UserQuiz>(
        "SELECT quiz_id, score, attempts FROM user_quizzes WHERE user_id = $1",
    );
    let study_time_query = sqlx::query_as::<_, UserStudyTime>(
        "SELECT date, minutes FROM user_study_time WHERE user_id = $1",
    );

    let progress_data = progress_query.bind(user_id).fetch_all(pool).await?;
    let quizzes_data = quizzes_query.bind(user_id).fetch_all(pool).await?;
    let study_time_data = study_time_query.bind(user_id).fetch_all(pool).await?;

    let progress_df = df!(
        "course_id" => progress_data.iter().map(|p| p.course_id).collect::<Vec<_>>(),
        "module_id" => progress_data.iter().map(|p| p.module_id).collect::<Vec<_>>(),
        "progress" => progress_data.iter().map(|p| p.progress).collect::<Vec<_>>(),
    )
    .unwrap();

    let quizzes_df = df!(
        "quiz_id" => quizzes_data.iter().map(|q| q.quiz_id).collect::<Vec<_>>(),
        "score" => quizzes_data.iter().map(|q| q.score).collect::<Vec<_>>(),
        "attempts" => quizzes_data.iter().map(|q| q.attempts).collect::<Vec<_>>(),
    )
    .unwrap();

    let study_time_df = df!(
        "date" => study_time_data.iter().map(|s| s.date).collect::<Vec<_>>(),
        "minutes" => study_time_data.iter().map(|s| s.minutes).collect::<Vec<_>>(),
    )
    .unwrap();

    Ok((progress_df, quizzes_df, study_time_df))
}

pub fn process_user_data(
    progress_df: &DataFrame,
    quizzes_df: &DataFrame,
    study_time_df: &DataFrame,
) -> Result<DataFrame, PolarsError> {
    println!("Processing user data with Polars...");

    // Example 1: Calculate average quiz score
    let avg_quiz_score: f64 = quizzes_df
        .column("score")?
        .as_series()
        .unwrap()
        .mean()
        .unwrap_or(0.0);
    println!("Average Quiz Score: {}", avg_quiz_score);

    // Example 2: Calculate total study minutes
    let total_study_minutes: f64 = study_time_df
        .column("minutes")?
        .as_series()
        .unwrap()
        .sum()
        .unwrap_or(0) as f64;
    println!("Total Study Minutes: {}", total_study_minutes);

    // Example 3: Join progress and quizzes (dummy join for demonstration)
    let joined_df = progress_df
        .clone()
        .lazy()
        .join(
            quizzes_df.clone().lazy(),
            [col("quiz_id")], // Assuming a common 'quiz_id' for joining, adjust as needed
            [col("quiz_id")],
            JoinArgs::new(JoinType::Left),
        )
        .collect()?;

    println!("Joined DataFrame:\n{:?}", joined_df);

    // For demonstration, let's return a simple DataFrame with aggregated metrics
    let processed_metrics = df!(
        "avg_quiz_score" => &[avg_quiz_score],
        "total_study_minutes" => &[total_study_minutes],
        "num_progress_records" => &[progress_df.height() as f64],
        "num_quiz_records" => &[quizzes_df.height() as f64],
        "num_study_time_records" => &[study_time_df.height() as f64],
    )?;

    Ok(processed_metrics)
}
