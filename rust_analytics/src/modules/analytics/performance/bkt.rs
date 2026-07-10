use serde::{Deserialize, Serialize};

// BKTParams holds the parameters for the Bayesian Knowledge Tracing model.
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BKTParams {
    /// p_init: The prior probability of the student knowing the skill.
    pub p_init: f64,
    /// p_slip: The probability of the student making a mistake on a question
    /// even if they know the skill.
    pub p_slip: f64,
    /// p_guess: The probability of the student guessing the correct answer
    /// even if they don't know the skill.
    pub p_guess: f64,
    /// p_transit: The probability of the student transitioning from not knowing
    /// the skill to knowing it after an opportunity to learn.
    pub p_transit: f64,
}

impl Default for BKTParams {
    /// Provides default, commonly used values for BKT parameters.
    fn default() -> Self {
        Self {
            p_init: 0.4,     // Initial knowledge probability
            p_slip: 0.1,     // Probability of slipping
            p_guess: 0.2,    // Probability of guessing
            p_transit: 0.15, // Probability of learning
        }
    }
}

/// Updates the probability of a student knowing a skill based on their answer.
///
/// # Arguments
///
/// * `p_known_prev` - The previous probability of the student knowing the skill.
/// * `is_correct` - Whether the student's answer was correct.
/// * `params` - The BKT model parameters.
///
/// # Returns
///
/// The updated probability of the student knowing the skill.
pub fn update_p_known(p_known_prev: f64, is_correct: bool, params: &BKTParams) -> f64 {
    let p_slip = params.p_slip;
    let p_guess = params.p_guess;
    let p_transit = params.p_transit;

    let p_known_cond = if is_correct {
        // If the answer is correct, update based on slip.
        p_known_prev * (1.0 - p_slip)
            / (p_known_prev * (1.0 - p_slip) + (1.0 - p_known_prev) * p_guess)
    } else {
        // If the answer is incorrect, update based on guess.
        p_known_prev * p_slip / (p_known_prev * p_slip + (1.0 - p_known_prev) * (1.0 - p_guess))
    };

    // Apply the transit probability (learning).
    p_known_cond + (1.0 - p_known_cond) * p_transit
}
