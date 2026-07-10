# Polars (Rust) — Usage and Recommendations

This document provides recommendations for using Polars effectively in the `rust_analytics` service.

Why these recommendations
- Polars is a fast, memory-efficient dataframe library in Rust.
- It's great for in-process analytics but requires careful use to avoid crashes or memory pressure.

Best practices
1. Prefer LazyFrame for heavy joins and aggregations
   - Use `.lazy()` pipelines and `collect()` only at the end to benefit from query optimization.
   - This minimizes intermediate allocations and improves performance.

2. Avoid `.unwrap()` on Polars ops in production
   - Use `?` to return errors instead of panics. This keeps the service resilient.
   - Example: `let df = df!(...) ?;` or `let col = df.column("score")?;`.

3. Use typed Series/Columns where possible
   - Convert to concrete column types (`.f64()`) instead of `.as_series()` when you expect a numeric type.

4. Use `groupby` and aggregations for summarization
   - Avoid pulling large DataFrames into in-memory Rust vectors.
   - Example: `df.lazy().groupby([col("topic")]).agg([col("score").mean()])`.

5. Watch out for memory spiky operations
   - For huge datasets, consider streaming or chunk processing or benchmark the queries under load.

6. Be mindful of dtype conversion for dates
   - When working with `NaiveDate`, convert into `Polars` date/datetime types explicitly to avoid runtime errors.

7. Keep the workspace small in request handlers
   - For per-request DataFrames, process only what's needed and limit the rows pulled by SQL queries.

8. Use join keys correctly
   - Avoid accidental cartesian joins by ensuring join keys exist on both sides of the join.

9. Use meaningful error messages
   - When Polars operations fail, wrap the error with context (e.g., `context` or add a log message), making it easier to debug.

Code snippets to apply
```rust
// Prefer lazy join
let joined = progress_df
    .clone()
    .lazy()
    .join(
        quizzes_df.lazy(),
        [col("quiz_id")],
        [col("quiz_id")],
        JoinArgs::new(JoinType::Left),
    )
    .select([col("course_id"), col("quiz_id"), col("score")])
    .collect()?;

// Convert to typed Cols safely
let avg_score = quizzes_df.column("score")?.f64()?.mean().unwrap_or(0.0);
```

Possible enhancements
- Add `polars` integration tests to validate data pipeline operations on representative datasets.
- Add metrics for memory usage when running heavy polars queries to alert on high memory usage.

Sign-off
- Follow these patterns when adding new polars transformations to improve robustness and save resource consumption.