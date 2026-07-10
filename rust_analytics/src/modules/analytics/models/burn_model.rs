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

// Function to perform a dummy prediction using the linear model
pub fn predict_with_linear_model<B: Backend>(input_data: Vec<f32>) -> Vec<f32> {
    // Instantiate the backend device to satisfy the generic parameter (no-op here)
    let _device = B::Device::default();

    // Deterministic weights (no training): small progressive coefficients
    let weights: Vec<f32> = (0..input_data.len())
        .map(|i| (i as f32 + 1.0) * 0.13_f32)
        .collect();

    // Simple linear combination + bias
    let bias: f32 = 0.5;
    let mut sum: f32 = 0.0;
    for (x, w) in input_data.iter().zip(weights.iter()) {
        sum += x * w;
    }
    let raw = sum + bias;

    // Apply a sigmoid to map to (0,1) as a probability-like output
    let prob = 1.0_f32 / (1.0_f32 + (-raw).exp());

    vec![prob]
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
    if inputs.is_empty() || labels.is_empty() || inputs.len() != labels.len() {
        return None;
    }

    let n_samples = inputs.len();
    let n_features = inputs[0].len();

    // initialize weights and bias to small values
    let mut weights = vec![0.1_f32; n_features];
    let mut bias = 0.0_f32;

    for _ in 0..epochs {
        let mut dw = vec![0.0_f32; n_features];
        let mut db = 0.0_f32;

        for (x, &y) in inputs.iter().zip(labels.iter()) {
            // linear prediction
            let mut pred = bias;
            for i in 0..n_features {
                pred += x[i] * weights[i];
            }

            let err = pred - y;
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
    }

    Some((weights, bias))
}

/// Save weights and bias to a simple text file: one line bias, next line space-separated weights
pub fn save_model(path: &str, weights: &[f32], bias: f32) -> std::io::Result<()> {
    use std::fs;
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
    let bias_line = lines.next()?;
    let bias: f32 = bias_line.trim().parse().ok()?;
    let weights_line = lines.next().unwrap_or("");
    let weights: Vec<f32> = weights_line
        .split_whitespace()
        .filter_map(|s| s.parse::<f32>().ok())
        .collect();
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

/// Predict using loaded model from `path`. Falls back to deterministic predictor if load fails.
pub fn predict_with_saved_model<B: Backend>(input_data: Vec<f32>, path: &str) -> Vec<f32> {
    if let Some((weights, bias)) = load_model(path) {
        let mut sum = bias;
        for (x, w) in input_data.iter().zip(weights.iter()) {
            sum += x * w;
        }
        let prob = 1.0_f32 / (1.0_f32 + (-sum).exp());
        return vec![prob];
    }

    // fallback to deterministic implementation
    predict_with_linear_model::<B>(input_data)
}
