use crate::shared::error::AnalyticsError;
use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use std::env;
use actix_web::{body::EitherBody, dev::{Service, ServiceRequest, ServiceResponse, Transform}, Error, ResponseError};
use futures_util::future::{ok, LocalBoxFuture, Ready};

pub type AnalyticsResult<T> = std::result::Result<T, AnalyticsError>;

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String,
    pub exp: usize,
}

/// Validate a bearer JWT using the secret in JWT_SECRET.
/// Returns an error if the env var is missing or the token is invalid.
///
/// # C++ RAII Pattern Applied:
/// - Error is propagated up the call stack, not swallowed
/// - Token is dropped after validation (no unnecessary copies)
/// - Secret is read from environment once and validated early
pub fn validate_token(token: &str) -> AnalyticsResult<Claims> {
    let token = token.trim_start_matches("Bearer ");
    let secret = env::var("JWT_SECRET").unwrap_or_else(|_| String::from(""));

    if secret.is_empty() {
        // Fail fast: no sensible validation possible without a secret.
        // Caller must handle this and avoid trusting requests without auth context.
        return Err(AnalyticsError::AuthenticationFailed(
            "JWT_SECRET not configured".to_string(),
        ));
    }

    // Use the secret as raw bytes (UTF-8)
    // JWT tokens are typically signed with the string value, not base64-decoded
    let key = secret.as_bytes();
    let validation = Validation::new(Algorithm::HS256);

    decode::<Claims>(token, &DecodingKey::from_secret(key), &validation)
        .map(|data| data.claims)
        .map_err(|e| {
            AnalyticsError::AuthenticationFailed(format!("Token validation failed: {}", e))
        })
}

/// Actix-web authentication middleware (JWT + optional API key fallback)
pub struct Auth;

impl<S, B> Transform<S, ServiceRequest> for Auth
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type InitError = ();
    type Transform = AuthMiddleware<S>;
    type Future = Ready<std::result::Result<Self::Transform, Self::InitError>>;

    fn new_transform(&self, service: S) -> Self::Future {
        ok(AuthMiddleware { service })
    }
}

pub struct AuthMiddleware<S> {
    service: S,
}

impl<S, B> Service<ServiceRequest> for AuthMiddleware<S>
where
    S: Service<ServiceRequest, Response = ServiceResponse<B>, Error = Error> + 'static,
    S::Future: 'static,
    B: 'static,
{
    type Response = ServiceResponse<EitherBody<B>>;
    type Error = Error;
    type Future = LocalBoxFuture<'static, std::result::Result<Self::Response, Self::Error>>;

    fn poll_ready(&self, cx: &mut std::task::Context<'_>) -> std::task::Poll<std::result::Result<(), Self::Error>> {
        self.service.poll_ready(cx)
    }

    fn call(&self, req: ServiceRequest) -> Self::Future {
        let path = req.path().to_string();

        // Allow unauthenticated health checks
        if path == "/health" {
            let fut = self.service.call(req);
            return Box::pin(async move { fut.await.map(|res| res.map_into_left_body()) });
        }

        let headers = req.headers();

        // API Key fallback
        if let Some(api_key_header) = headers.get("x-api-key") {
            if let Ok(api_key) = api_key_header.to_str() {
                let expected_api_key = env::var("RUST_ANALYTICS_API_KEY").unwrap_or_default();
                if !expected_api_key.is_empty() && api_key == expected_api_key {
                    let fut = self.service.call(req);
                    return Box::pin(async move { fut.await.map(|res| res.map_into_left_body()) });
                }
            }
        }

        // JWT
        if let Some(auth_header) = headers.get("Authorization") {
            if let Ok(auth_str) = auth_header.to_str() {
                if auth_str.starts_with("Bearer ") {
                    let token = auth_str.trim_start_matches("Bearer ");
                    match validate_token(token) {
                        Ok(_claims) => {
                            let fut = self.service.call(req);
                            return Box::pin(async move { fut.await.map(|res| res.map_into_left_body()) });
                        }
                        Err(e) => {
                            eprintln!("Token validation error: {}", e);
                            let err = AnalyticsError::AuthenticationFailed(e.to_string());
                            let res = req.into_response(err.error_response());
                            return Box::pin(async { Ok(res.map_into_right_body()) });
                        }
                    }
                }
            }
        }

        let error = AnalyticsError::AuthenticationFailed("Missing or invalid authentication".to_string());
        let res = req.into_response(error.error_response());
        Box::pin(async { Ok(res.map_into_right_body()) })
    }
}
