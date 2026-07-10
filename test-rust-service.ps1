# Test script for Rust Analytics Service
# This script tests the Rust service with proper JWT authentication

Write-Host "=== Rust Analytics Service Test ===" -ForegroundColor Green
Write-Host ""

# The JWT token generated with proper HS256 signature
# Secret: r91t0ofaB1PoLXM5NNGQWOWkie5FDZ1p6aMhLl3an24=
# Subject: user123
# Expires: 2026-11-19T16:48:18.000Z (1 year validity)

$validToken = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiJ1c2VyMTIzIiwiZXhwIjoxNzk1MTA2ODk4LCJpYXQiOjE3NjM1NzA4OTh9.LneSJt41N_uW4wPD8W_vKyIcWFf9dB6GtkrU5HKfHMY"

# Test 1: Health Check (should require auth and fail without token)
Write-Host "Test 1: Health Check without authentication" -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -Method GET -SkipHttpErrorCheck
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "Error occurred: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test 2: Health Check with JWT token" -ForegroundColor Cyan
try {
    $headers = @{
        "Authorization" = "Bearer $validToken"
        "Content-Type" = "application/json"
    }
    
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/health" -Method GET -Headers $headers -SkipHttpErrorCheck
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    Write-Host "Response: $($response.Content)" -ForegroundColor Green
} catch {
    Write-Host "Error occurred: $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "Test 3: Get User Recommendations" -ForegroundColor Cyan
try {
    $headers = @{
        "Authorization" = "Bearer $validToken"
        "Content-Type" = "application/json"
    }
    
    $body = @{
        userId = "test-user-123"
    } | ConvertTo-Json
    
    $response = Invoke-WebRequest -Uri "http://127.0.0.1:8000/recommendations/get_recommendations_ai" `
        -Method POST `
        -Headers $headers `
        -Body $body `
        -SkipHttpErrorCheck
    
    Write-Host "Status: $($response.StatusCode)" -ForegroundColor Green
    if ($response.Content.Length -lt 500) {
        Write-Host "Response: $($response.Content)" -ForegroundColor Green
    } else {
        Write-Host "Response: $(($response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 2))" -ForegroundColor Green
    }
} catch {
    Write-Host "Error occurred (expected if user not in DB): $_" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Green
Write-Host ""
Write-Host "Service Status:"
Write-Host "  - HTTP Server: http://127.0.0.1:8000" -ForegroundColor Cyan
Write-Host "  - gRPC Server: grpc://[::1]:50051" -ForegroundColor Cyan
Write-Host "  - Authentication: JWT (Bearer token required)" -ForegroundColor Cyan
Write-Host "  - Database: PostgreSQL (medical_tracker)" -ForegroundColor Cyan
Write-Host ""
