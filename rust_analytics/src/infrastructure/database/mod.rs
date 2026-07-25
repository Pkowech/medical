//! Database module - unified data models as single source of truth
//! 
//! This module contains database access functionality.
//! Models are defined in the domain layer.

use dotenvy::dotenv;
use sqlx::{postgres::PgPoolOptions, Error, Pool, Postgres};
use std::env;
pub mod repositories;

/// Initialize database connection pool
pub async fn init_pool() -> Result<Pool<Postgres>, Error> {
    dotenv().ok();
    
    let database_url = env::var("DATABASE_URL")
        .unwrap_or_else(|_| {
            eprintln!("⚠️  WARNING: DATABASE_URL not set. Using default PostgreSQL connection.");
            eprintln!("Set DATABASE_URL environment variable to use a real database.");
            String::from("postgresql://postgres:[REDACTED]@localhost:5432/medtrack")
        });
    
    eprintln!("🔗 Connecting to database at: {}", database_url.split('@').last().unwrap_or("unknown"));
    
    // Attempt to connect with timeout
    match tokio::time::timeout(
        std::time::Duration::from_secs(10),
        PgPoolOptions::new()
            .max_connections(5)
            .connect(&database_url)
    ).await {
        Ok(Ok(pool)) => {
            eprintln!("✅ Database pool created successfully");
            Ok(pool)
        }
        Ok(Err(e)) => {
            eprintln!("❌ Failed to connect to database: {}", e);
            eprintln!("⚠️  Continuing without database. Some endpoints may fail.");
            Err(e)
        }
        Err(_) => {
            eprintln!("❌ Database connection timed out after 10s");
            eprintln!("⚠️  Continuing without database. Some endpoints may fail.");
            Err(Error::Configuration("Database connection timeout".into()))
        }
    }
}
