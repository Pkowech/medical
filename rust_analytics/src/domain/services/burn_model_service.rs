use burn::tensor::backend::Backend;

/// Wrapper for burn-based models. The original `predict_with_burn` call
/// referenced in gRPC maps to `predict_with_saved_model` in `burn_model.rs`.
pub fn predict_with_saved_model<B: Backend>(_user_id: &str, features: Vec<f32>, path: &str) -> (f32, String) {
    // For now, delegate to modules implementation which provides `predict_with_saved_model`.
    let res = crate::modules::analytics::models::burn_model::predict_with_saved_model::<B>(features, path);
    // Return score and a made-up version string for compatibility
    (res.get(0).cloned().unwrap_or(0.0), "v0".to_string())
}

/// Async wrapper for predict_with_burn
pub async fn predict_with_burn(_user_id: &str) -> Result<f32, Box<dyn std::error::Error>> {
    // Placeholder implementation
    Ok(0.5)
}
