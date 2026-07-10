use serde::Deserialize;
use std::env;

#[derive(Debug, Deserialize, Clone)]
pub struct DatabaseConfig {
    pub url: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct GrpcConfig {
    pub host: String,
    pub port: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct HttpConfig {
    pub host: String,
    pub port: String,
}

#[derive(Debug, Deserialize, Clone)]
pub struct AppConfig {
    pub database: DatabaseConfig,
    pub grpc: GrpcConfig,
    pub http: HttpConfig,
    pub jwt_secret: String,
    pub rust_api_key: String,
    pub bkt_strength_threshold: f64,
    pub bkt_weakness_threshold: f64,
    pub linfa_enabled: bool,
    pub linfa_weight: f64,
}

impl AppConfig {
    pub fn from_env() -> Result<Self, String> {
        dotenvy::dotenv().ok();

        let database_url = env::var("DATABASE_URL").map_err(|e| format!("DATABASE_URL not set: {}", e))?;
        let grpc_host = env::var("RUST_ANALYTICS_GRPC_HOST").unwrap_or_else(|_| "[::1]".to_string());
        let grpc_port = env::var("RUST_ANALYTICS_GRPC_PORT").unwrap_or_else(|_| "50051".to_string());
        let http_host = env::var("RUST_ANALYTICS_HOST").unwrap_or_else(|_| "127.0.0.1".to_string());
        let http_port = env::var("RUST_ANALYTICS_PORT").unwrap_or_else(|_| "8000".to_string());
        let jwt_secret = env::var("JWT_SECRET").map_err(|e| format!("JWT_SECRET not set: {}", e))?;
        let rust_api_key = env::var("RUST_API_KEY").unwrap_or_default();

        let bkt_strength_threshold = env::var("BKT_STRENGTH_THRESHOLD")
            .unwrap_or_else(|_| "0.75".to_string())
            .parse::<f64>()
            .unwrap_or(0.75);
        let bkt_weakness_threshold = env::var("BKT_WEAKNESS_THRESHOLD")
            .unwrap_or_else(|_| "0.6".to_string())
            .parse::<f64>()
            .unwrap_or(0.6);
        let linfa_enabled = env::var("LINFA_ENABLED")
            .unwrap_or_else(|_| "true".to_string())
            .to_lowercase();
        let linfa_enabled = linfa_enabled == "true" || linfa_enabled == "1";
        let linfa_weight = env::var("LINFA_WEIGHT")
            .unwrap_or_else(|_| "0.4".to_string())
            .parse::<f64>()
            .unwrap_or(0.4);

        Ok(AppConfig {
            database: DatabaseConfig { url: database_url },
            grpc: GrpcConfig { host: grpc_host, port: grpc_port },
            http: HttpConfig { host: http_host, port: http_port },
            jwt_secret,
            rust_api_key,
            bkt_strength_threshold,
            bkt_weakness_threshold,
            linfa_enabled,
            linfa_weight,
        })
    }
}
