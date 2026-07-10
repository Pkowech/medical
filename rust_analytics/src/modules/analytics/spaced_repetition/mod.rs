// Spaced Repetition Analytics Module
// Tracks flashcard progress, intervals, ease factors (SM-2 algorithm)
// 
// This module provides analytics and aggregation for spaced repetition metrics,
// including retention statistics, ease factor distributions, and learning trends.

pub mod analytics;

pub use analytics::{
    SpacedRepetitionAnalytics, SpacedRepetitionStats, IntervalRetention,
    EaseFactorDistribution, ProgressTrend, SpacedRepetitionError,
};
