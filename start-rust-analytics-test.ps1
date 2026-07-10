#!/usr/bin/env pwsh

<#
.SYNOPSIS
Rust Analytics + NestJS Integration Quick Start Script
Starts all services and runs integration tests

.DESCRIPTION
This script handles:
1. Starting PostgreSQL, Redis, NestJS Backend, and Rust Analytics
2. Running database migrations and seeding
3. Executing integration tests
4. Displaying results and health status

.EXAMPLE
.\start-rust-analytics-test.ps1

.NOTES
Requires: Docker, Docker Compose, Node.js, Rust/Cargo
#>

Write-Host "`n╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  Rust Analytics + NestJS Integration - Quick Start             ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# Configuration
$SERVICES = @(
    @{ name = "postgres"; port = 5432; cmd = "pg_isready -U postgres -d medtrack_dev" },
    @{ name = "redis"; port = 6379; cmd = "redis-cli ping" },
    @{ name = "backend"; port = 3002; cmd = "curl -s http://localhost:3002/api/health" },
    @{ name = "rust-analytics"; port = 50051; cmd = "curl -s http://localhost:8000/health" }
)

function Test-Service {
    param([string]$Name, [int]$Port, [string]$HealthCmd)
    
    try {
        $result = Invoke-Expression $HealthCmd -ErrorAction Stop
        Write-Host "✅ $Name is running (port $Port)" -ForegroundColor Green
        return $true
    }
    catch {
        Write-Host "❌ $Name is not responding (port $Port)" -ForegroundColor Red
        return $false
    }
}

function Start-Services {
    Write-Host "`n📋 Step 1: Starting Services with Docker Compose" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    Write-Host "`n  Pulling latest images..." -ForegroundColor Gray
    docker-compose pull
    
    Write-Host "`n  Starting services..." -ForegroundColor Gray
    docker-compose up -d
    
    Write-Host "`n  Waiting for services to be healthy..." -ForegroundColor Gray
    $maxAttempts = 30
    $attempt = 0
    
    while ($attempt -lt $maxAttempts) {
        $attempt++
        Write-Host "  Attempt $attempt/$maxAttempts..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
        
        $healthCheck = docker-compose ps | Select-String "healthy"
        if ($healthCheck) {
            Write-Host "`n✅ All services are healthy`n" -ForegroundColor Green
            return $true
        }
    }
    
    Write-Host "`n⚠️  Services took longer than expected. Checking status..." -ForegroundColor Yellow
    docker-compose ps
    return $false
}

function Seed-Database {
    Write-Host "`n📋 Step 2: Seeding Database" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    Push-Location backend
    try {
        Write-Host "`n  Running seed script..." -ForegroundColor Gray
        pnpm run seed 2>&1 | Select-Object -Last 10
        Write-Host "`n✅ Database seeding complete`n" -ForegroundColor Green
    }
    finally {
        Pop-Location
    }
}

function Run-Integration-Tests {
    Write-Host "`n📋 Step 3: Running Integration Tests" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    Push-Location backend
    try {
        Write-Host "`n  Executing integration test suite..`n" -ForegroundColor Gray
        node test-rust-analytics-integration.js
        $testResult = $LASTEXITCODE
        return $testResult -eq 0
    }
    finally {
        Pop-Location
    }
}

function Show-Service-Status {
    Write-Host "`n📋 Service Health Status" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    docker-compose ps
    
    Write-Host "`n📋 Detailed Service Information:" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    # Check each service
    $allHealthy = $true
    foreach ($service in $SERVICES) {
        $healthy = Test-Service -Name $service.name -Port $service.port -HealthCmd $service.cmd
        if (-not $healthy) { $allHealthy = $false }
    }
    
    return $allHealthy
}

function Show-Logs {
    Write-Host "`n📋 Recent Service Logs" -ForegroundColor Yellow
    Write-Host "─────────────────────────────────────────────────────────────────" -ForegroundColor Gray
    
    Write-Host "`nPostgreSQL Logs:" -ForegroundColor Cyan
    docker-compose logs postgres | Select-Object -Last 5
    
    Write-Host "`nRedis Logs:" -ForegroundColor Cyan
    docker-compose logs redis | Select-Object -Last 5
    
    Write-Host "`nBackend Logs:" -ForegroundColor Cyan
    docker-compose logs backend | Select-Object -Last 10
    
    Write-Host "`nRust Analytics Logs:" -ForegroundColor Cyan
    docker-compose logs rust-analytics | Select-Object -Last 10
}

function Show-Next-Steps {
    Write-Host "`n╔══════════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
    Write-Host "║  Next Steps                                                      ║" -ForegroundColor Cyan
    Write-Host "╠══════════════════════════════════════════════════════════════════╣" -ForegroundColor Cyan
    Write-Host "║  🔍 View Database:        pnpm prisma studio                    ║" -ForegroundColor Cyan
    Write-Host "║  📊 Check Metrics:        curl http://localhost:8000/metrics    ║" -ForegroundColor Cyan
    Write-Host "║  🔗 Backend API:          http://localhost:3002/api             ║" -ForegroundColor Cyan
    Write-Host "║  📝 View Logs:            docker-compose logs -f               ║" -ForegroundColor Cyan
    Write-Host "║  🛑 Stop Services:        docker-compose down                  ║" -ForegroundColor Cyan
    Write-Host "╚══════════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan
}

# Main execution
try {
    # Step 1: Start services
    Start-Services
    
    # Step 2: Seed database
    Seed-Database
    
    # Step 3: Run tests
    $testsPassed = Run-Integration-Tests
    
    # Step 4: Show status
    Show-Service-Status
    
    # Step 5: Show next steps
    Show-Next-Steps
    
    if ($testsPassed) {
        Write-Host "✅ All integration tests passed! System is ready for production.`n" -ForegroundColor Green
        exit 0
    }
    else {
        Write-Host "⚠️  Some tests failed. Review the output above for details.`n" -ForegroundColor Yellow
        exit 1
    }
}
catch {
    Write-Host "`n❌ Error: $_" -ForegroundColor Red
    Show-Logs
    exit 1
}
