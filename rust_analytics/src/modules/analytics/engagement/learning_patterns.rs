use polars::prelude::*;

use rand::Rng;

#[derive(Debug, serde::Serialize)]
pub struct LearningPatterns {
    pub average_study_time: f64,
    pub study_consistency: f64,
    pub preferred_study_days: Vec<String>,
    pub quiz_accuracy: f64,
    pub learning_style: String,
    pub topic_preferences: Vec<String>,
}

pub fn analyze_learning_patterns(study_df: &DataFrame, quizzes_df: &DataFrame) -> LearningPatterns {
    let avg_study_time = study_df
        .column("minutes")
        .unwrap()
        .as_series()
        .unwrap()
        .mean()
        .unwrap_or(0.0);

    let consistency = if study_df.height() > 1 {
        // polars std() requires ddof (degrees of freedom) param of type u8
        study_df
            .column("minutes")
            .unwrap()
            .f64()
            .unwrap()
            .std(0)
            .unwrap_or(0.0)
    } else {
        0.0
    };

    let accuracy = quizzes_df
        .column("score")
        .unwrap()
        .as_series()
        .unwrap()
        .mean()
        .unwrap_or(0.0);

    // Placeholder logic from the Python version
    let learning_styles = vec!["visual", "auditory", "kinesthetic", "reading/writing"];
    let mut rng = rand::thread_rng();
    let idx = rng.gen_range(0..learning_styles.len());
    let style = learning_styles[idx];

    let topic_preferences = vec!["Anatomy", "Pharmacology"]; // Hardcoded as in Python

    LearningPatterns {
        average_study_time: avg_study_time,
        study_consistency: consistency,
        preferred_study_days: vec![], // Placeholder, as in Python
        quiz_accuracy: accuracy,
        learning_style: style.to_string(),
        topic_preferences: topic_preferences.iter().map(|s| s.to_string()).collect(),
    }
}
