use burn::{
    config::Config,
    module::Module,
    nn::{Linear, LinearConfig},
    tensor::{backend::Backend, Tensor},
};

// Define the configuration for our simple linear model
#[derive(Config, Debug)]
pub struct LinearModelConfig {
    pub input_size: usize,
    pub output_size: usize,
}

// Define the linear model itself
#[derive(Module, Debug)]
pub struct LinearModel<B: Backend> {
    linear: Linear<B>,
}

impl<B: Backend> LinearModel<B> {
    // Constructor to create a new model from its configuration
    pub fn new(config: &LinearModelConfig, device: &B::Device) -> Self {
        Self {
            linear: LinearConfig::new(config.input_size, config.output_size).init(device),
        }
    }

    // Forward pass: takes an input tensor and returns an output tensor
    pub fn forward(&self, input: Tensor<B, 2>) -> Tensor<B, 2> {
        self.linear.forward(input)
    }
}

/// Train a simple linear model (weights + bias) using batch gradient descent.
/// - `inputs`: Vec of feature vectors (n_samples x n_features)
/// - `labels`: Vec of labels (n_samples)
/// Returns (weights, bias)
pub fn train_linear_model(
    inputs: Vec<Vec<f32>>,
    labels: Vec<f32>,
    epochs: usize,
    lr: f32,
) -> Option<(Vec<f32>, f32)> {
    if inputs.len() < 2
        || inputs.len() != labels.len()
        || inputs[0].is_empty()
        || inputs.iter().any(|row| row.len() != inputs[0].len())
        || inputs.iter().flatten().any(|value| !value.is_finite())
        || labels
            .iter()
            .any(|label| !label.is_finite() || !(0.0..=1.0).contains(label))
        || epochs == 0
        || !lr.is_finite()
        || lr <= 0.0
    {
        return None;
    }

    let n_samples = inputs.len();
    let n_features = inputs[0].len();
    let mut weights = vec![0.0_f32; n_features];
    let mut bias = 0.0_f32;

    for _ in 0..epochs {
        let mut dw = vec![0.0_f32; n_features];
        let mut db = 0.0_f32;

        for (x, &y) in inputs.iter().zip(labels.iter()) {
            let mut logit = bias;
            for i in 0..n_features {
                logit += x[i] * weights[i];
            }
            let probability = 1.0 / (1.0 + (-logit).exp());
            let err = probability - y;
            for i in 0..n_features {
                dw[i] += err * x[i];
            }
            db += err;
        }

        // update weights (mean gradient)
        for i in 0..n_features {
            weights[i] -= lr * (dw[i] / n_samples as f32);
        }
        bias -= lr * (db / n_samples as f32);
        if weights.iter().any(|weight| !weight.is_finite()) || !bias.is_finite() {
            return None;
        }
    }

    Some((weights, bias))
}

/// Save weights and bias to a simple text file: one line bias, next line space-separated weights
pub fn save_model(path: &str, weights: &[f32], bias: f32) -> std::io::Result<()> {
    use std::fs;
    if weights.is_empty() || !bias.is_finite() || weights.iter().any(|weight| !weight.is_finite()) {
        return Err(std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "Model parameters must be finite and include at least one weight",
        ));
    }
    let mut contents = format!("{}\n", bias);
    let w_strs: Vec<String> = weights.iter().map(|w| w.to_string()).collect();
    contents.push_str(&w_strs.join(" "));
    fs::write(path, contents)
}

/// Load weights and bias from the simple text format used in `save_model`.
pub fn load_model(path: &str) -> Option<(Vec<f32>, f32)> {
    use std::fs;
    let data = fs::read_to_string(path).ok()?;
    let mut lines = data.lines();
    let bias: f32 = lines.next()?.trim().parse().ok()?;
    let weights_line = lines.next()?;
    if lines.next().is_some() {
        return None;
    }
    let weights: Vec<f32> = weights_line
        .split_whitespace()
        .map(str::parse::<f32>)
        .collect::<Result<_, _>>()
        .ok()?;
    if weights.is_empty() || !bias.is_finite() || weights.iter().any(|weight| !weight.is_finite()) {
        return None;
    }
    Some((weights, bias))
}

/// Train and persist a model to `path` using gradient descent. Returns true on success.
pub fn train_and_save(
    inputs: Vec<Vec<f32>>,
    labels: Vec<f32>,
    epochs: usize,
    lr: f32,
    path: &str,
) -> bool {
    if let Some((weights, bias)) = train_linear_model(inputs, labels, epochs, lr) {
        if save_model(path, &weights, bias).is_ok() {
            return true;
        }
    }
    false
}

/// Predict with a trained model. Missing or incompatible models are explicit errors.
pub fn predict_with_saved_model(input_data: Vec<f32>, path: &str) -> Result<Vec<f32>, String> {
    if input_data.is_empty() || input_data.iter().any(|value| !value.is_finite()) {
        return Err("Prediction features must be non-empty and finite".to_string());
    }

    let (weights, bias) =
        load_model(path).ok_or_else(|| format!("No trained model is available at {path}"))?;
    if weights.len() != input_data.len() {
        return Err(format!(
            "Model expects {} features but received {}",
            weights.len(),
            input_data.len()
        ));
    }
    let logit = input_data
        .iter()
        .zip(weights.iter())
        .fold(bias, |sum, (feature, weight)| sum + feature * weight);
    Ok(vec![1.0 / (1.0 + (-logit).exp())])
}

#[cfg(test)]
mod tests {
    use super::train_linear_model;

    #[test]
    fn logistic_training_learns_from_labeled_examples() {
        let (weights, bias) =
            train_linear_model(vec![vec![0.0], vec![1.0]], vec![0.0, 1.0], 1000, 0.1)
                .expect("valid examples should train");
        let predict = |feature: f32| 1.0 / (1.0 + (-(bias + weights[0] * feature)).exp());

        assert!(predict(1.0) > predict(0.0));
        assert!(weights[0].is_finite());
        assert!(bias.is_finite());
    }

    #[test]
    fn logistic_training_rejects_invalid_examples() {
        assert!(train_linear_model(vec![vec![1.0], vec![2.0]], vec![0.0], 10, 0.1).is_none());
        assert!(train_linear_model(
            vec![vec![f32::INFINITY], vec![1.0]],
            vec![0.0, 1.0],
            10,
            0.1
        )
        .is_none());
        assert!(train_linear_model(vec![vec![1.0], vec![2.0]], vec![0.0, 2.0], 10, 0.1).is_none());
    }
}
