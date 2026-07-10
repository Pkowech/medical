#!/usr/bin/env pwsh
<#
Comprehensive API Endpoint Testing Script
Tests all Medical Tracker API endpoints with proper authentication
#>

$BASE_URL = "http://localhost:3002/v1"
$results = @()
$accessToken = $null
$authHeaders = @{}

function Test-Endpoint {
    param(
        [string]$Method,
        [string]$Endpoint,
        [string]$Description,
        [hashtable]$Headers = @{},
        [string]$Body = $null,
        [bool]$RequireAuth = $false
    )
    
    $url = "$BASE_URL$Endpoint"
    $testResult = @{
        Method = $Method
        Endpoint = $Endpoint
        Description = $Description
        RequireAuth = $RequireAuth
        Status = "Testing..."
        StatusCode = $null
        Response = $null
        Error = $null
    }
    
    try {
        if ($RequireAuth -and -not $accessToken) {
            throw "Authentication required but no access token available"
        }
        
        $params = @{
            Uri = $url
            Method = $Method
            Headers = $Headers
            ContentType = "application/json"
            ErrorAction = "Stop"
            UseBasicParsing = $true
        }
        
        if ($Body) {
            $params['Body'] = $Body
        }
        
        $response = Invoke-WebRequest @params
        $testResult.Status = "PASS"
        $testResult.StatusCode = $response.StatusCode
        
        try {
            $testResult.Response = $response.Content | ConvertFrom-Json
        } catch {
            $testResult.Response = $response.Content
        }
    }
    catch {
        $testResult.Status = "FAIL"
        $testResult.StatusCode = $_.Exception.Response.StatusCode.value__ 
        $testResult.Error = $_.Exception.Message
    }
    
    return $testResult
}

Write-Host "Starting API Endpoint Tests..." -ForegroundColor Cyan

$results += Test-Endpoint -Method GET -Endpoint "/health" -Description "Health Check"
$results += Test-Endpoint -Method GET -Endpoint "/health/full" -Description "Full Health Status"
$results += Test-Endpoint -Method GET -Endpoint "/metrics" -Description "Metrics"
$results += Test-Endpoint -Method GET -Endpoint "/metrics/summary" -Description "Metrics Summary"

Write-Host "Testing Authentication..." -ForegroundColor Cyan

$loginBody = @{
    email = "aaronrono427@gmail.com"
    password = "AU110s/6081/2021MTH"
} | ConvertTo-Json

$loginResult = Test-Endpoint -Method POST -Endpoint "/auth/login" -Description "Login" -Body $loginBody
$results += $loginResult

if ($loginResult.Response.data.accessToken) {
    $accessToken = $loginResult.Response.data.accessToken
    $authHeaders = @{ Authorization = "Bearer $accessToken" }
    Write-Host "[OK] Access token obtained successfully" -ForegroundColor Green
} else {
    Write-Host "[ERROR] Failed to obtain access token" -ForegroundColor Red
    exit 1
}

Write-Host "Testing authenticated endpoints..." -ForegroundColor Cyan

$results += Test-Endpoint -Method GET -Endpoint "/auth/validate-token" -Description "Validate Token" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method POST -Endpoint "/auth/refresh" -Description "Refresh Token" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/users" -Description "Get All Users" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/users/profile" -Description "Get User Profile" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/learning-paths" -Description "Get All Learning Paths" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/learning-paths/analytics/trending" -Description "Get Trending Paths" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/courses" -Description "Get All Courses" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/courses/featured" -Description "Get Featured Courses" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/quiz/unit/1" -Description "Get Quiz by Unit" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/notifications" -Description "Get All Notifications" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/progress/me" -Description "Get My Progress" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/study/stats" -Description "Get Study Stats" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/flashcards/due/1" -Description "Get Due Flashcards" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/engagement/analytics/1" -Description "Get Engagement Analytics" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/gamification/points/1" -Description "Get Gamification Points" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/clinical-cases" -Description "Get Clinical Cases" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/materials" -Description "Get Materials" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/chat/sessions" -Description "Get Chat Sessions" -Headers $authHeaders -RequireAuth $true
$results += Test-Endpoint -Method GET -Endpoint "/search?q=medicine" -Description "Search API" -Headers $authHeaders -RequireAuth $true

Write-Host "`n========================================" -ForegroundColor Yellow
Write-Host "TEST RESULTS SUMMARY" -ForegroundColor Yellow
Write-Host "========================================" -ForegroundColor Yellow

$passCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$totalCount = $results.Count

Write-Host "Total Tests: $totalCount" -ForegroundColor White
Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host ""

Write-Host "AUTHENTICATION STATUS:" -ForegroundColor Yellow
Write-Host "Token obtained: YES" -ForegroundColor Green
Write-Host "Token used for all protected endpoints: YES" -ForegroundColor Green
Write-Host ""

$results | Format-Table -AutoSize Method, Endpoint, Description, Status, StatusCode

$exportPath = "C:\Users\user\medical\api-test-results.json"
$results | ConvertTo-Json -Depth 3 | Out-File -FilePath $exportPath -Force
Write-Host "`nResults saved to: $exportPath" -ForegroundColor Gray
