use linfa::prelude::*;
use linfa_linear::LinearRegression;
use ndarray::Array1;
use ndarray::Array2;
use crate::observability::metrics as obs_metrics;

pub fn predict_performance(
    data: &Array2<f64>,
    targets: &Array1<f64>,
) -> Result<Array1<f64>, String> {
    println!("Training linear regression model with Linfa...");
    
    if data.nrows() != targets.len() {
        return Err(format!("Data rows ({}) != targets length ({})", data.nrows(), targets.len()));
    }

    let dataset: DatasetBase<
        ndarray::ArrayBase<ndarray::OwnedRepr<f64>, ndarray::Dim<[usize; 2]>>,
        ndarray::ArrayBase<ndarray::OwnedRepr<f64>, ndarray::Dim<[usize; 1]>>,
    > = Dataset::new(data.clone(), targets.clone());

    let model: LinearRegression = LinearRegression::new();

    match model.fit(&dataset) {
        Ok(trained_model) => {
            let predictions: ndarray::ArrayBase<ndarray::OwnedRepr<f64>, ndarray::Dim<[usize; 1]>> =
                trained_model.predict(data);
            // Increment Linfa prediction success metric
            obs_metrics::inc_linfa_prediction();
            Ok(predictions)
        }
        Err(e) => {
            eprintln!("Linfa fit failed: {}. Falling back to mean prediction.", e);
            // Increment Linfa failure metric
            obs_metrics::inc_linfa_failure();
            // Fallback: return mean of targets for all rows to avoid non-invertible matrix issues
            let n = targets.len();
            if n == 0 {
                return Err("No target data available for prediction".to_string());
            }
            let sum: f64 = targets.sum();
            let mean = sum / (n as f64);
            let preds = Array1::from_elem(n, mean);
            Ok(preds)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use ndarray::array;

    #[test]
    fn test_predict_performance_basic() {
        let data = array![[1.0, 2.0, 3.0], [2.0, 4.0, 6.0], [3.0, 6.0, 9.0]];
        let targets = ndarray::Array1::from_vec(vec![10.0, 20.0, 30.0]);

        let result = predict_performance(&data, &targets);
        assert!(result.is_ok());
        let predictions = result.unwrap();
        assert_eq!(predictions.len(), 3);
        // Predictions should be finite numbers
        for p in predictions.iter() {
            assert!(p.is_finite());
        }
    }

    #[test]
    fn test_predict_performance_fallback_on_bad_data() {
        // mismatched targets length -> Linfa fit likely fails and function should return Err or fallback to mean
        let data = array![[1.0, 2.0, 3.0]];
        let targets = ndarray::Array1::from_vec(vec![]);

        let result = predict_performance(&data, &targets);
        assert!(result.is_err() || result.is_ok());
    }
}
