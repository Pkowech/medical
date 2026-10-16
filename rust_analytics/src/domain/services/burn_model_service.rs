/// Predicts only from a trained, user-specific model artifact.
pub fn predict_with_saved_model(
    _user_id: &str,
    features: Vec<f32>,
    path: &str,
) -> Result<(f32, String), String> {
    let predictions =
        crate::modules::analytics::models::burn_model::predict_with_saved_model(features, path)?;
    let score = predictions
        .first()
        .copied()
        .ok_or_else(|| "Trained model returned no prediction".to_string())?;
    Ok((score, "saved-model".to_string()))
}

pub async fn predict_with_burn(_user_id: &str) -> Result<f32, String> {
    Err("Burn prediction requires a trained model and real feature vector".to_string())
}
