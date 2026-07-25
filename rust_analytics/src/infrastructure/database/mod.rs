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
            eprintln!("WARNING: DATABASE_URL not set. Using default PostgreSQL connection.");
            eprintln!("Set DATABASE_URL environment variable to use a real database.");
            String::from("postgresql://postgres:password@localhost:5432/medtrack")
        });
    
    eprintln!("Connecting to database at: {}", database_url.split('@').last().unwrap_or("unknown"));
    
    PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
}
