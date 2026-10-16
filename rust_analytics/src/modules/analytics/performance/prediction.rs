use crate::observability::metrics as obs_metrics;
use linfa::prelude::*;
use linfa_linear::LinearRegression;
use ndarray::Array1;
use ndarray::Array2;

pub fn predict_performance(
    training_data: &Array2<f64>,
    targets: &Array1<f64>,
    prediction_data: &Array2<f64>,
) -> Result<Array1<f64>, String> {
    if training_data.nrows() != targets.len() || training_data.nrows() < 2 {
        return Err(format!(
            "Training requires at least two rows and one target per row ({} rows, {} targets)",
            training_data.nrows(),
            targets.len()
        ));
    }
    if training_data.ncols() == 0 || training_data.ncols() != prediction_data.ncols() {
        return Err(format!(
            "Training and prediction data must have the same non-zero feature count ({} != {})",
            training_data.ncols(),
            prediction_data.ncols()
        ));
    }
    if training_data
        .iter()
        .chain(targets.iter())
        .chain(prediction_data.iter())
        .any(|value| !value.is_finite())
    {
        return Err("Training data, targets, and prediction data must be finite".to_string());
    }

    let dataset = Dataset::new(training_data.clone(), targets.clone());

    let model = LinearRegression::new();

    match model.fit(&dataset) {
        Ok(trained_model) => {
            let predictions = trained_model.predict(prediction_data);
            obs_metrics::inc_linfa_prediction();
            Ok(predictions)
        }
        Err(e) => {
            obs_metrics::inc_linfa_failure();
            Err(format!("Linfa model training failed: {e}"))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ndarray::array;

    #[test]
    fn test_predict_performance_basic() {
        let training_data = array![[1.0, 1.0], [2.0, 1.0], [1.0, 2.0], [2.0, 2.0]];
        let targets = ndarray::Array1::from_vec(vec![10.0, 20.0, 20.0, 30.0]);
        let prediction_data = array![[3.0, 3.0]];

        let result = predict_performance(&training_data, &targets, &prediction_data);
        assert!(result.is_ok());
        let predictions = result.unwrap();
        assert_eq!(predictions.len(), 1);
        assert!(predictions[0].is_finite());
        assert!((predictions[0] - 50.0).abs() < 1.0);
    }

    #[test]
    fn test_predict_performance_rejects_missing_training_labels() {
        let training_data = array![[1.0, 2.0], [2.0, 3.0]];
        let targets = ndarray::Array1::from_vec(vec![10.0]);
        let prediction_data = array![[3.0, 4.0]];

        assert!(predict_performance(&training_data, &targets, &prediction_data).is_err());
    }
}
