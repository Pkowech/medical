use actix_web::{http::StatusCode, HttpResponse, ResponseError};
use std::fmt;

/// Custom error type for the analytics service.
/// Follows C++ RAII principles: errors are structured, resources cleaned up,
/// and error context preserved throughout the call stack.
#[allow(dead_code)]
#[derive(Debug, PartialEq)]
pub enum AnalyticsError {
    #[allow(dead_code)]
    /// Invalid or missing user id
    InvalidUserId,
    #[allow(dead_code)]
    /// Provided score or attempt value is invalid
    InvalidScore,
    AuthenticationFailed(String),
    #[allow(dead_code)]
    AuthorizationFailed(String),
    DatabaseError(String),
    #[allow(dead_code)]
    ValidationError(String),
    #[allow(dead_code)]
    /// Calculation-specific error (e.g. numeric issues)
    CalculationError(String),
    #[allow(dead_code)]
    /// Dataset provided was empty when data was expected
    EmptyDataset,
    InternalError(String),
    #[allow(dead_code)]
    NotFound(String),
    #[allow(dead_code)]
    Cache(String),
    #[allow(dead_code)]
    Prediction(String),
    #[allow(dead_code)]
    InsufficientData,
    #[allow(dead_code)]
    UserNotFound(String),
    #[allow(dead_code)]
    Config(String),
}

impl fmt::Display for AnalyticsError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            AnalyticsError::AuthenticationFailed(msg) => {
                write!(f, "Authentication failed: {}", msg)
            }
            AnalyticsError::InvalidUserId => write!(f, "Invalid or missing user id"),
            AnalyticsError::InvalidScore => write!(f, "Invalid score or attempt value"),
            AnalyticsError::CalculationError(msg) => write!(f, "Calculation error: {}", msg),
            AnalyticsError::EmptyDataset => write!(f, "Empty dataset provided"),
            AnalyticsError::AuthorizationFailed(msg) => write!(f, "Authorization failed: {}", msg),
            AnalyticsError::DatabaseError(msg) => write!(f, "Database error: {}", msg),
            AnalyticsError::ValidationError(msg) => write!(f, "Validation error: {}", msg),
            AnalyticsError::InternalError(msg) => write!(f, "Internal error: {}", msg),
            AnalyticsError::NotFound(msg) => write!(f, "Not found: {}", msg),
            AnalyticsError::Cache(msg) => write!(f, "Cache error: {}", msg),
            AnalyticsError::Prediction(msg) => write!(f, "Model prediction failed: {}", msg),
            AnalyticsError::InsufficientData => write!(f, "Insufficient data for analysis"),
            AnalyticsError::UserNotFound(msg) => write!(f, "User not found: {}", msg),
            AnalyticsError::Config(msg) => write!(f, "Configuration error: {}", msg),
        }
    }
}

impl ResponseError for AnalyticsError {
    fn error_response(&self) -> HttpResponse {
        let (status, error_type) = match self {
            AnalyticsError::AuthenticationFailed(_) => {
                (StatusCode::UNAUTHORIZED, "AUTHENTICATION_FAILED")
            }
            AnalyticsError::AuthorizationFailed(_) => {
                (StatusCode::FORBIDDEN, "AUTHORIZATION_FAILED")
            }
            AnalyticsError::ValidationError(_) => (StatusCode::BAD_REQUEST, "VALIDATION_ERROR"),
            AnalyticsError::InvalidUserId => (StatusCode::BAD_REQUEST, "INVALID_USER_ID"),
            AnalyticsError::InvalidScore => (StatusCode::BAD_REQUEST, "INVALID_SCORE"),
            AnalyticsError::EmptyDataset => (StatusCode::BAD_REQUEST, "EMPTY_DATASET"),
            AnalyticsError::CalculationError(_) => (StatusCode::INTERNAL_SERVER_ERROR, "CALCULATION_ERROR"),
            AnalyticsError::NotFound(_) => (StatusCode::NOT_FOUND, "NOT_FOUND"),
            AnalyticsError::UserNotFound(_) => (StatusCode::NOT_FOUND, "USER_NOT_FOUND"),
            AnalyticsError::InsufficientData => (StatusCode::BAD_REQUEST, "INSUFFICIENT_DATA"),
            AnalyticsError::DatabaseError(_) | AnalyticsError::InternalError(_) | 
            AnalyticsError::Cache(_) | AnalyticsError::Prediction(_) | AnalyticsError::Config(_) => {
                (StatusCode::INTERNAL_SERVER_ERROR, "INTERNAL_ERROR")
            }
        };

        HttpResponse::build(status).json(serde_json::json!({
            "error": error_type,
            "message": self.to_string(),
        }))
    }

    fn status_code(&self) -> StatusCode {
        match self {
            AnalyticsError::AuthenticationFailed(_) => StatusCode::UNAUTHORIZED,
            AnalyticsError::AuthorizationFailed(_) => StatusCode::FORBIDDEN,
            AnalyticsError::ValidationError(_) => StatusCode::BAD_REQUEST,
            AnalyticsError::InvalidUserId => StatusCode::BAD_REQUEST,
            AnalyticsError::InvalidScore => StatusCode::BAD_REQUEST,
            AnalyticsError::EmptyDataset => StatusCode::BAD_REQUEST,
            AnalyticsError::InsufficientData => StatusCode::BAD_REQUEST,
            AnalyticsError::CalculationError(_) => StatusCode::INTERNAL_SERVER_ERROR,
            AnalyticsError::NotFound(_) | AnalyticsError::UserNotFound(_) => StatusCode::NOT_FOUND,
            AnalyticsError::DatabaseError(_) | AnalyticsError::InternalError(_) |
            AnalyticsError::Cache(_) | AnalyticsError::Prediction(_) | AnalyticsError::Config(_) => {
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    }
}

impl From<String> for AnalyticsError {
    fn from(s: String) -> Self {
        AnalyticsError::InternalError(s)
    }
}

impl From<&str> for AnalyticsError {
    fn from(s: &str) -> Self {
        AnalyticsError::InternalError(s.to_string())
    }
}

impl From<sqlx::Error> for AnalyticsError {
    fn from(err: sqlx::Error) -> Self {
        AnalyticsError::DatabaseError(err.to_string())
    }
}

impl From<jsonwebtoken::errors::Error> for AnalyticsError {
    fn from(err: jsonwebtoken::errors::Error) -> Self {
        AnalyticsError::AuthenticationFailed(err.to_string())
    }
}

impl From<actix_web::Error> for AnalyticsError {
    fn from(err: actix_web::Error) -> Self {
        AnalyticsError::InternalError(format!("Actix Web error: {}", err))
    }
}

/// Result type alias for analytics operations.
pub type Result<T> = std::result::Result<T, AnalyticsError>;

