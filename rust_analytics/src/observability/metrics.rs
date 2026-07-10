use prometheus::{Encoder, IntCounter, IntCounterVec, Opts, Registry, TextEncoder, GaugeVec};
use once_cell::sync::Lazy;
// use std::collections::HashMap; // Not used

static REGISTRY: Lazy<Registry> = Lazy::new(|| Registry::new());

static BKT_GAPS_DERIVED: Lazy<IntCounter> = Lazy::new(|| {
    let c = IntCounter::with_opts(Opts::new("bkt_gaps_derived_total", "Number of times BKT gaps were used to derive recommendations")).unwrap();
    REGISTRY.register(Box::new(c.clone())).unwrap();
    c
});

static BKT_UPDATE_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    let c = IntCounter::with_opts(Opts::new("bkt_update_total", "Total number of BKT updates performed")).unwrap();
    REGISTRY.register(Box::new(c.clone())).unwrap();
    c
});

static BKT_UPDATE_IMPROVEMENT_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    let c = IntCounter::with_opts(Opts::new("bkt_update_improvement_total", "Number of BKT updates where p_known increased")).unwrap();
    REGISTRY.register(Box::new(c.clone())).unwrap();
    c
});

static ADAPTIVE_QUESTION_SELECTED: Lazy<IntCounterVec> = Lazy::new(|| {
    let c = IntCounterVec::new(
        Opts::new("adaptive_question_selected_total", "Adaptive questions selected count"),
        &["topic"],
    )
    .unwrap();
    REGISTRY.register(Box::new(c.clone())).unwrap();
    c
});

static LINFA_PREDICTION_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    let c = IntCounter::with_opts(Opts::new("linfa_prediction_total", "Total number of Linfa predictions performed")).unwrap();
    REGISTRY.register(Box::new(c.clone())).unwrap();
    c
});

static LINFA_FAILURE_TOTAL: Lazy<IntCounter> = Lazy::new(|| {
    let c = IntCounter::with_opts(Opts::new("linfa_failure_total", "Linfa prediction failures (errors)")).unwrap();
    REGISTRY.register(Box::new(c.clone())).unwrap();
    c
});

/// Increment counters and return current metrics text for scrape exposure.
pub fn inc_bkt_gaps_derived() {
    BKT_GAPS_DERIVED.inc();
}

pub fn inc_bkt_update(improved: bool) {
    BKT_UPDATE_TOTAL.inc();
    if improved {
        BKT_UPDATE_IMPROVEMENT_TOTAL.inc();
    }
}

pub fn inc_adaptive_question_selected(topic: &str) {
    ADAPTIVE_QUESTION_SELECTED.with_label_values(&[topic]).inc();
}

pub fn inc_linfa_prediction() {
    LINFA_PREDICTION_TOTAL.inc();
}

pub fn inc_linfa_failure() {
    LINFA_FAILURE_TOTAL.inc();
}

// GaugeVec to track aggregated BKT skill average p_known values per skill
static BKT_SKILL_AVG: Lazy<GaugeVec> = Lazy::new(|| {
    let g = GaugeVec::new(
        Opts::new("bkt_skill_average_p_known", "Average p_known per skill as tracked by BKT"),
        &["skill"],
    )
    .unwrap();
    REGISTRY.register(Box::new(g.clone())).unwrap();
    g
});

pub fn set_bkt_skill_avg(skill: &str, value: f64) {
    BKT_SKILL_AVG.with_label_values(&[skill]).set(value);
}

pub fn gather_metrics() -> String {
    let encoder = TextEncoder::new();
    let metric_families = REGISTRY.gather();
    let mut buffer = Vec::new();
    encoder.encode(&metric_families, &mut buffer).unwrap();
    String::from_utf8(buffer).unwrap_or_default()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_metrics_increment_and_gather() {
        inc_bkt_gaps_derived();
        inc_bkt_update(true);
        inc_adaptive_question_selected("anatomy");
        let out = gather_metrics();
        assert!(out.contains("bkt_gaps_derived_total"));
        assert!(out.contains("bkt_update_total"));
        assert!(out.contains("adaptive_question_selected_total"));
    }
}

