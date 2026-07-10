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
    let database_url = env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    PgPoolOptions::new()
        .max_connections(5)
        .connect(&database_url)
        .await
}
