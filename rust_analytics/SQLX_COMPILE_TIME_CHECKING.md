# sqlx Compile-Time Checking Setup

## Overview

This project uses sqlx's compile-time checking feature to ensure database queries are type-safe and match the actual database schema at compile time. This eliminates the need for manual struct definitions and keeps Rust code synchronized with database changes automatically.

## How It Works

Instead of hand-writing structs like:
```rust
#[derive(FromRow)]
pub struct CourseProgress {
    pub id: String,
    pub user_id: String,
    // ... manually list all fields
}
```

We use `sqlx::query!` macro which:
1. Connects to the database at **compile time**
2. Verifies the SQL query is valid
3. Automatically determines result types
4. Generates type-safe code

## Setup

### 1. Environment Configuration

Create `.env` file in `rust_analytics/`:
```bash
DATABASE_URL=postgresql://user:password@localhost:5432/medical_tracker
```

Or use `.env.example` as template:
```bash
cp .env.example .env
# Edit .env with your actual database credentials
```

### 2. Install sqlx-cli (Optional but Recommended)

```bash
cargo install sqlx-cli --no-default-features --features postgres
```

### 3. Verify Database Connection

```bash
sqlx database create
sqlx migrate run
```

## Usage Pattern

### Basic Query with Type Checking

**Before (manual struct):**
```rust
#[derive(FromRow)]
pub struct CourseProgress {
    pub id: String,
    pub user_id: String,
    pub course_id: String,
    pub progress_percentage: i32,
    pub created_at: NaiveDateTime,
}

// Later in code:
let rows = sqlx::query_as::<_, CourseProgress>(
    "SELECT id, user_id, course_id, progress_percentage, created_at FROM course_progress"
)
.fetch_all(&pool)
.await?;
```

**After (compile-time checked):**
```rust
// Single query, single result type - no separate struct needed
let rows = sqlx::query!(
    "SELECT id, user_id, course_id, progress_percentage, created_at FROM course_progress"
)
.fetch_all(&pool)
.await?;

// Fields accessed as: row.id, row.user_id, row.course_id, etc.
// Types verified at compile time!
```

### Query with Parameters

```rust
let user_id = "abc123";
let rows = sqlx::query!(
    "SELECT id, status, progress_percentage FROM course_progress WHERE user_id = $1",
    user_id
)
.fetch_all(&pool)
.await?;

for row in rows {
    println!("Course: {} - Progress: {}%", row.id, row.progress_percentage);
}
```

### Single Row Query

```rust
let course_id = "course-001";
let row = sqlx::query!(
    "SELECT * FROM course_progress WHERE course_id = $1 LIMIT 1",
    course_id
)
.fetch_optional(&pool)
.await?;

if let Some(row) = row {
    println!("Found: {} - {}%", row.id, row.progress_percentage);
}
```

### Insert Query

```rust
let result = sqlx::query!(
    "INSERT INTO course_progress (id, user_id, course_id, status, progress_percentage, created_at)
     VALUES ($1, $2, $3, $4, $5, $6)",
    "id-123",
    "user-456",
    "course-789",
    "in_progress",
    50,
    chrono::Utc::now()
)
.execute(&pool)
.await?;
```

### Update Query

```rust
let rows_affected = sqlx::query!(
    "UPDATE course_progress SET progress_percentage = $1, updated_at = $2 WHERE id = $3",
    75,
    chrono::Utc::now(),
    course_progress_id
)
.execute(&pool)
.await?
.rows_affected();
```

## Benefits

1. **Zero Manual Sync** - No need to manually update Rust structs when schema changes
2. **Compile-Time Safety** - Invalid queries caught at build time, not runtime
3. **Type Inference** - Field types auto-detected from database schema
4. **Refactoring Safety** - Column renames/deletions caught immediately
5. **Self-Documenting** - Queries show exactly what's being selected

## Migration Path

### Phase 1: New Code (Current)
- New queries use `sqlx::query!` macro
- Old hand-written models still supported
- Can coexist during transition

### Phase 2: Gradual Refactoring
- Convert high-traffic query paths first
- Profile performance improvements
- Remove old models as coverage increases

### Phase 3: Complete Migration (Future)
- All queries use compile-time checking
- Delete hand-written model definitions
- Simpler, more maintainable codebase

## Offline Mode (CI/CD)

For offline builds (e.g., in CI), use `.sqlx` cache:

```bash
# Generate cache (run once with DB access)
cargo sqlx prepare --database-url $DATABASE_URL

# CI/CD can now build without DB access
SQLX_OFFLINE=true cargo build
```

## Troubleshooting

### "DATABASE_URL not set" error
```bash
# Make sure .env file exists and is readable
ls -la .env
cat .env
```

### "Unable to connect to database" error
```bash
# Verify database is running and accessible
psql $DATABASE_URL -c "SELECT 1"

# Check connection string format
# Should be: postgresql://user:password@host:port/database
```

### "Column not found" at compile time
- Schema has changed since last `cargo build`
- Run: `sqlx database create && sqlx migrate run`
- Then retry `cargo build`

### Slow builds
- First build is slow as it verifies all queries
- Subsequent builds are cached
- Use `SQLX_OFFLINE=true` for CI builds

## Next Steps

1. ✅ Updated Cargo.toml with `macros` feature
2. ✅ Created `.env.example` template
3. 📋 Create `.env` with your database credentials
4. 📋 Start using `sqlx::query!` in new code
5. 📋 Gradually migrate existing queries

## Example Implementation

See `src/modules/analytics/core/queries.rs` for practical examples of compile-time checked queries.
