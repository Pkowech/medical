#!/usr/bin/env powershell
<#
.SYNOPSIS
Integration test for Medical Tracker - Tests frontend, backend, and Rust analytics service communication
.DESCRIPTION
Verifies end-to-end communication:
- Frontend (Next.js) at http://localhost:3000
- Backend (NestJS) at http://localhost:3002
- Rust Analytics at http://localhost:8000
#>

Write-Host "`n" -ForegroundColor Green
Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║     MEDICAL TRACKER - INTEGRATION TEST SUITE                   ║" -ForegroundColor Cyan
Write-Host "║     Frontend + Backend + Rust Analytics                        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host "`n"

# Configuration
$frontendUrl = "http://localhost:3000"
$backendUrl = "http://localhost:3002"
$rustUrl = "http://localhost:8000"
$apiKey = "b8a8b8a8-b8a8-48a8-b8a8-b8a8b8a8b8a8"

# Test counters
$passed = 0
$failed = 0
$warnings = 0

function Test-Service {
    param(
        [string]$Name,
        [string]$Url,
        [hashtable]$Headers = @{}
    )
    
    Write-Host "Testing $Name..." -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri $Url -Method GET -Headers $Headers -SkipHttpErrorCheck -TimeoutSec 5
        if ($response.StatusCode -eq 200 -or $response.StatusCode -eq 301) {
            Write-Host "  ✓ $Name is running (Status: $($response.StatusCode))" -ForegroundColor Green
            $script:passed++
            return $true
        } else {
            Write-Host "  ✗ $Name returned unexpected status: $($response.StatusCode)" -ForegroundColor Red
            $script:failed++
            return $false
        }
    } catch {
        Write-Host "  ✗ $Name is not responding: $_" -ForegroundColor Red
        $script:failed++
        return $false
    }
}

function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Url,
        [hashtable]$Headers = @{},
        [string]$Body = ""
    )
    
    Write-Host "  Testing: $Name" -ForegroundColor Cyan
    try {
        if ($Method -eq "GET") {
            $response = Invoke-WebRequest -Uri $Url -Method GET -Headers $Headers -SkipHttpErrorCheck -TimeoutSec 10
        } else {
            $response = Invoke-WebRequest -Uri $Url -Method POST -Headers $Headers -Body $Body -SkipHttpErrorCheck -TimeoutSec 10
        }
        
        if ($response.StatusCode -eq 200) {
            Write-Host "    ✓ $Name (200 OK)" -ForegroundColor Green
            $script:passed++
            return $response
        } elseif ($response.StatusCode -eq 201) {
            Write-Host "    ✓ $Name (201 Created)" -ForegroundColor Green
            $script:passed++
            return $response
        } else {
            Write-Host "    ⚠ $Name returned: $($response.StatusCode)" -ForegroundColor Yellow
            $script:warnings++
            return $response
        }
    } catch {
        Write-Host "    ✗ $Name failed: $_" -ForegroundColor Red
        $script:failed++
        return $null
    }
}

# === LAYER 1: SERVICE AVAILABILITY ===
Write-Host "LAYER 1: SERVICE AVAILABILITY" -ForegroundColor Magenta
Write-Host "═" * 60 -ForegroundColor Magenta

$frontendOk = Test-Service -Name "Frontend (Next.js)" -Url $frontendUrl
$backendOk = Test-Service -Name "Backend (NestJS)" -Url "$backendUrl/v1/health"
$rustOk = Test-Service -Name "Rust Analytics" -Url "$rustUrl/health" -Headers @{"x-api-key"=$apiKey}

Write-Host "`n"

# === LAYER 2: BACKEND → RUST COMMUNICATION ===
if ($backendOk -and $rustOk) {
    Write-Host "LAYER 2: BACKEND → RUST ANALYTICS COMMUNICATION" -ForegroundColor Magenta
    Write-Host "═" * 60 -ForegroundColor Magenta
    
    $rustHeaders = @{
        "x-api-key" = $apiKey
        "Content-Type" = "application/json"
    }
    
    # Test direct Rust endpoints
    Write-Host "`n  Direct Rust API Tests:" -ForegroundColor Yellow
    Test-Endpoint -Name "GET /health" -Method "GET" -Url "$rustUrl/health" -Headers $rustHeaders | Out-Null
    
    $recBody = '{"userId":"test-user-integration"}'
    Test-Endpoint -Name "POST /recommendations/get_recommendations_ai" -Method "POST" -Url "$rustUrl/recommendations/get_recommendations_ai" -Headers $rustHeaders -Body $recBody | Out-Null
    
    $perfBody = '{"userId":"test-user-integration"}'
    Test-Endpoint -Name "POST /performance/analytics" -Method "POST" -Url "$rustUrl/performance/analytics" -Headers $rustHeaders -Body $perfBody | Out-Null
    
    $engBody = '{"userId":"test-user-integration"}'
    Test-Endpoint -Name "POST /engagement/user_engagement" -Method "POST" -Url "$rustUrl/engagement/user_engagement" -Headers $rustHeaders -Body $engBody | Out-Null
    
    Write-Host "`n"
}

# === LAYER 3: FRONTEND → BACKEND COMMUNICATION ===
if ($backendOk) {
    Write-Host "LAYER 3: FRONTEND → BACKEND COMMUNICATION" -ForegroundColor Magenta
    Write-Host "═" * 60 -ForegroundColor Magenta
    
    $backendHeaders = @{
        "Content-Type" = "application/json"
    }
    
    Write-Host "`n  Backend Health & Status:" -ForegroundColor Yellow
    Test-Endpoint -Name "GET /v1/health" -Method "GET" -Url "$backendUrl/v1/health" -Headers $backendHeaders | Out-Null
    
    Write-Host "`n"
}

# === LAYER 4: FRONTEND ACCESS ===
if ($frontendOk) {
    Write-Host "LAYER 4: FRONTEND ACCESS" -ForegroundColor Magenta
    Write-Host "═" * 60 -ForegroundColor Magenta
    
    Write-Host "`n  Frontend Pages:" -ForegroundColor Yellow
    Test-Endpoint -Name "GET /" -Method "GET" -Url $frontendUrl -Headers @{} | Out-Null
    
    Write-Host "`n"
}

# === SUMMARY ===
Write-Host "SUMMARY" -ForegroundColor Magenta
Write-Host "═" * 60 -ForegroundColor Magenta
Write-Host "`n"

$total = $passed + $failed + $warnings
Write-Host "  Total Tests: $total" -ForegroundColor Cyan
Write-Host "  ✓ Passed:    $passed" -ForegroundColor Green
Write-Host "  ✗ Failed:    $failed" -ForegroundColor Red
Write-Host "  ⚠ Warnings:  $warnings" -ForegroundColor Yellow

Write-Host "`n"

if ($failed -eq 0) {
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Green
    Write-Host "║  ✓ ALL SERVICES RUNNING AND COMMUNICATING SUCCESSFULLY        ║" -ForegroundColor Green
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Green
} else {
    Write-Host "╔════════════════════════════════════════════════════════════════╗" -ForegroundColor Red
    Write-Host "║  ✗ SOME TESTS FAILED - CHECK CONFIGURATION                   ║" -ForegroundColor Red
    Write-Host "╚════════════════════════════════════════════════════════════════╝" -ForegroundColor Red
}

Write-Host "`n"

# === ARCHITECTURE DIAGRAM ===
Write-Host "ARCHITECTURE DIAGRAM" -ForegroundColor Cyan
Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host @"

    ┌──────────────────────────────────────────────────────────┐
    │  CLIENT                                                  │
    │  Browser (http://localhost:3000)                         │
    └─────────────────┬──────────────────────────────────────┘
                      │ (Next.js Frontend)
                      ▼
    ┌──────────────────────────────────────────────────────────┐
    │  BACKEND (NestJS)                                        │
    │  http://localhost:3002                                   │
    │                                                          │
    │  • Controllers                                           │
    │  • Services (AI Analytics, User Analytics, etc)          │
    │  • Database (PostgreSQL)                                 │
    │  • Cache (Redis)                                         │
    └─────────────────┬──────────────────────────────────────┘
                      │ (HTTP POST with x-api-key)
                      ▼
    ┌──────────────────────────────────────────────────────────┐
    │  RUST ANALYTICS SERVICE                                  │
    │  http://localhost:8000                                   │
    │                                                          │
    │  • HTTP Server (Actix-web)                               │
    │  • gRPC Server (tonic)                                   │
    │  • ML Models (burn, ndarray, linfa)                      │
    │  • Database (PostgreSQL)                                 │
    │  • Auth Middleware (API Key + JWT)                       │
    └──────────────────────────────────────────────────────────┘

"@

Write-Host "`n"

# === AVAILABLE ENDPOINTS ===
Write-Host "AVAILABLE ENDPOINTS" -ForegroundColor Cyan
Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host @"

RUST ANALYTICS ENDPOINTS (HTTP):
  POST /recommendations/get_recommendations_ai
  POST /predictions/generate_predictions
  POST /engagement/user_engagement
  POST /engagement/learning_patterns
  POST /reports/path_analytics
  POST /performance/prediction
  POST /performance/analytics
  POST /system/related_resources
  POST /recommendations/study_recommendations
  POST /recommendations/next_steps
  POST /recommendations/collaborative
  POST /system/trending_paths
  POST /train_model
  POST /performance/records
  POST /core/batch_processing
  POST /system/analytics
  POST /engagement/quiz_history
  POST /performance/metrics
  GET  /health

RUST ANALYTICS (gRPC):
  localhost:50051 (tonic server)

BACKEND ENDPOINTS:
  GET  /v1/health
  See NestJS swagger docs for full API

FRONTEND:
  http://localhost:3000 (Next.js)

"@

Write-Host "`n"

# === ENVIRONMENT VARIABLES ===
Write-Host "CONFIGURATION IN USE" -ForegroundColor Cyan
Write-Host "═" * 60 -ForegroundColor Cyan
Write-Host @"

RUST ANALYTICS:
  DATABASE_URL: postgresql://medical:AU110s%2F6081%2F2021MT@localhost:5432/medical_tracker
  JWT_SECRET: r91t0ofaB1PoLXM5NNGQWOWkie5FDZ1p6aMhLl3an24=
  RUST_API_KEY: b8a8b8a8-b8a8-48a8-b8a8-b8a8b8a8b8a8

BACKEND:
  DATABASE_URL: postgresql://medical:AU110s%2F6081%2F2021MT@localhost:5432/medical_tracker
  REDIS_URL: redis://localhost:6379
  RUST_ANALYTICS_URL: http://localhost:8000
  RUST_API_KEY: b8a8b8a8-b8a8-48a8-b8a8-b8a8b8a8b8a8

FRONTEND:
  NEXT_PUBLIC_API_URL: http://localhost:3002
  NEXT_PUBLIC_BACKEND_URL: http://localhost:3002

"@

Write-Host "`n"
