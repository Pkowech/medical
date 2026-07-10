#!/usr/bin/env pwsh
<#
Comprehensive API Endpoint Diagnostic Script
Tests each endpoint and provides detailed diagnostics
#>

$BASE_URL = "http://localhost:3002/v1"
$results = @()
$accessToken = $null
$authHeaders = @{}
$userId = $null

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
        Status = "PENDING"
        StatusCode = $null
        ResponseTime = 0
        BodySize = 0
        Error = $null
        ErrorDetails = $null
    }
    
    try {
        if ($RequireAuth -and -not $accessToken) {
            throw "Authentication required but no access token available"
        }
        
        $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
        
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
        $stopwatch.Stop()
        
        $testResult.Status = "PASS"
        $testResult.StatusCode = $response.StatusCode
        $testResult.ResponseTime = $stopwatch.ElapsedMilliseconds
        $testResult.BodySize = $response.Content.Length
        $testResult.Response = $response.Content
        
    }
    catch [System.Net.WebException] {
        $stopwatch.Stop()
        $testResult.Status = "FAIL"
        $testResult.ResponseTime = $stopwatch.ElapsedMilliseconds
        
        try {
            $errorResponse = $_.Exception.Response
            $testResult.StatusCode = [int]$errorResponse.StatusCode
            
            $reader = New-Object System.IO.StreamReader($errorResponse.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            $reader.Close()
            $testResult.ErrorDetails = $errorBody
        }
        catch {
            $testResult.StatusCode = $_.Exception.Response.StatusCode.value__
        }
        
        $testResult.Error = $_.Exception.Message
    }
    catch {
        $stopwatch.Stop()
        $testResult.Status = "ERROR"
        $testResult.ResponseTime = $stopwatch.ElapsedMilliseconds
        $testResult.Error = $_.Exception.Message
    }
    
    return $testResult
}

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "MEDICAL TRACKER API - COMPREHENSIVE ENDPOINT TEST" -ForegroundColor Cyan
Write-Host "===============================================" -ForegroundColor Cyan
Write-Host ""

# ==================== HEALTH & SYSTEM ====================
Write-Host "[1/10] Testing Health & System Endpoints..." -ForegroundColor Cyan

$h1 = Test-Endpoint -Method GET -Endpoint "/health" -Description "Health Check"
$results += $h1
Write-Host "  GET /health -> $($h1.Status) (HTTP $($h1.StatusCode)) [$($h1.ResponseTime)ms]"

$h2 = Test-Endpoint -Method GET -Endpoint "/health/full" -Description "Full Health Status"
$results += $h2
Write-Host "  GET /health/full -> $($h2.Status) (HTTP $($h2.StatusCode)) [$($h2.ResponseTime)ms]"

$h3 = Test-Endpoint -Method GET -Endpoint "/metrics" -Description "Metrics"
$results += $h3
Write-Host "  GET /metrics -> $($h3.Status) (HTTP $($h3.StatusCode)) [$($h3.ResponseTime)ms]"

# ==================== AUTHENTICATION ====================
Write-Host "[2/10] Testing Authentication..." -ForegroundColor Cyan

$loginBody = @{
    email = "aaronrono427@gmail.com"
    password = "AU110s/6081/2021MTH"
} | ConvertTo-Json

$a1 = Test-Endpoint -Method POST -Endpoint "/auth/login" -Description "Login" -Body $loginBody
$results += $a1
Write-Host "  POST /auth/login -> $($a1.Status) (HTTP $($a1.StatusCode)) [$($a1.ResponseTime)ms]"

if ($a1.Status -eq "PASS") {
    try {
        $loginJson = $a1.Response | ConvertFrom-Json -ErrorAction Stop
        if ($loginJson.data.accessToken) {
            $accessToken = $loginJson.data.accessToken
            $userId = $loginJson.data.user.id
            $authHeaders = @{ Authorization = "Bearer $accessToken" }
            Write-Host "  + Token obtained: $($accessToken.Substring(0,20))..." -ForegroundColor Green
            Write-Host "  + User ID: $userId" -ForegroundColor Green
        }
    }
    catch {
        Write-Host "  ! Error parsing login response: $_" -ForegroundColor Yellow
    }
}

$a2 = Test-Endpoint -Method GET -Endpoint "/auth/validate-token" -Description "Validate Token" -Headers $authHeaders -RequireAuth $true
$results += $a2
Write-Host "  GET /auth/validate-token -> $($a2.Status) (HTTP $($a2.StatusCode)) [$($a2.ResponseTime)ms]"

# ==================== USERS ====================
Write-Host "[3/10] Testing User Endpoints..." -ForegroundColor Cyan

$u1 = Test-Endpoint -Method GET -Endpoint "/users/profile" -Description "Get User Profile" -Headers $authHeaders -RequireAuth $true
$results += $u1
Write-Host "  GET /users/profile -> $($u1.Status) (HTTP $($u1.StatusCode)) [$($u1.ResponseTime)ms]"

$u2 = Test-Endpoint -Method GET -Endpoint "/users" -Description "Get All Users" -Headers $authHeaders -RequireAuth $true
$results += $u2
Write-Host "  GET /users -> $($u2.Status) (HTTP $($u2.StatusCode)) [$($u2.ResponseTime)ms]"

# ==================== LEARNING PATHS ====================
Write-Host "[4/10] Testing Learning Paths..." -ForegroundColor Cyan

$lp1 = Test-Endpoint -Method GET -Endpoint "/learning-paths" -Description "Get All Learning Paths" -Headers $authHeaders -RequireAuth $true
$results += $lp1
Write-Host "  GET /learning-paths -> $($lp1.Status) (HTTP $($lp1.StatusCode)) [$($lp1.ResponseTime)ms]"

$lp2 = Test-Endpoint -Method GET -Endpoint "/learning-paths/analytics/trending" -Description "Get Trending Paths" -Headers $authHeaders -RequireAuth $true
$results += $lp2
Write-Host "  GET /learning-paths/analytics/trending -> $($lp2.Status) (HTTP $($lp2.StatusCode)) [$($lp2.ResponseTime)ms]"

$lp3 = Test-Endpoint -Method GET -Endpoint "/learning-paths/analytics/personalized" -Description "Get Personalized Paths" -Headers $authHeaders -RequireAuth $true
$results += $lp3
Write-Host "  GET /learning-paths/analytics/personalized -> $($lp3.Status) (HTTP $($lp3.StatusCode)) [$($lp3.ResponseTime)ms]"

# ==================== COURSES ====================
Write-Host "[5/10] Testing Courses..." -ForegroundColor Cyan

$c1 = Test-Endpoint -Method GET -Endpoint "/courses" -Description "Get All Courses" -Headers $authHeaders -RequireAuth $true
$results += $c1
Write-Host "  GET /courses -> $($c1.Status) (HTTP $($c1.StatusCode)) [$($c1.ResponseTime)ms]"

$c2 = Test-Endpoint -Method GET -Endpoint "/courses/featured" -Description "Get Featured Courses" -Headers $authHeaders -RequireAuth $true
$results += $c2
Write-Host "  GET /courses/featured -> $($c2.Status) (HTTP $($c2.StatusCode)) [$($c2.ResponseTime)ms]"

$c3 = Test-Endpoint -Method GET -Endpoint "/courses/my-courses" -Description "Get My Courses" -Headers $authHeaders -RequireAuth $true
$results += $c3
Write-Host "  GET /courses/my-courses -> $($c3.Status) (HTTP $($c3.StatusCode)) [$($c3.ResponseTime)ms]"

# ==================== NOTIFICATIONS ====================
Write-Host "[6/10] Testing Notifications..." -ForegroundColor Cyan

$n1 = Test-Endpoint -Method GET -Endpoint "/notifications" -Description "Get All Notifications" -Headers $authHeaders -RequireAuth $true
$results += $n1
Write-Host "  GET /notifications -> $($n1.Status) (HTTP $($n1.StatusCode)) [$($n1.ResponseTime)ms]"

# ==================== PROGRESS ====================
Write-Host "[7/10] Testing Progress..." -ForegroundColor Cyan

$p1 = Test-Endpoint -Method GET -Endpoint "/progress/me" -Description "Get My Progress" -Headers $authHeaders -RequireAuth $true
$results += $p1
Write-Host "  GET /progress/me -> $($p1.Status) (HTTP $($p1.StatusCode)) [$($p1.ResponseTime)ms]"

# ==================== FLASHCARDS ====================
Write-Host "[8/10] Testing Flashcards..." -ForegroundColor Cyan

$f1 = Test-Endpoint -Method GET -Endpoint "/flashcards/due/1" -Description "Get Due Flashcards" -Headers $authHeaders -RequireAuth $true
$results += $f1
Write-Host "  GET /flashcards/due/1 -> $($f1.Status) (HTTP $($f1.StatusCode)) [$($f1.ResponseTime)ms]"

$f2 = Test-Endpoint -Method GET -Endpoint "/flashcards/stats/1" -Description "Get Flashcard Stats" -Headers $authHeaders -RequireAuth $true
$results += $f2
Write-Host "  GET /flashcards/stats/1 -> $($f2.Status) (HTTP $($f2.StatusCode)) [$($f2.ResponseTime)ms]"

# ==================== ENGAGEMENT & GAMIFICATION ====================
Write-Host "[9/10] Testing Engagement & Gamification..." -ForegroundColor Cyan

$e1 = Test-Endpoint -Method GET -Endpoint "/engagement/analytics/1" -Description "Get Engagement Analytics" -Headers $authHeaders -RequireAuth $true
$results += $e1
Write-Host "  GET /engagement/analytics/1 -> $($e1.Status) (HTTP $($e1.StatusCode)) [$($e1.ResponseTime)ms]"

$e2 = Test-Endpoint -Method GET -Endpoint "/gamification/points/1" -Description "Get Gamification Points" -Headers $authHeaders -RequireAuth $true
$results += $e2
Write-Host "  GET /gamification/points/1 -> $($e2.Status) (HTTP $($e2.StatusCode)) [$($e2.ResponseTime)ms]"

# ==================== OTHER ENDPOINTS ====================
Write-Host "[10/10] Testing Other Endpoints..." -ForegroundColor Cyan

$o1 = Test-Endpoint -Method GET -Endpoint "/materials" -Description "Get Materials" -Headers $authHeaders -RequireAuth $true
$results += $o1
Write-Host "  GET /materials -> $($o1.Status) (HTTP $($o1.StatusCode)) [$($o1.ResponseTime)ms]"

$o2 = Test-Endpoint -Method GET -Endpoint "/chat/sessions" -Description "Get Chat Sessions" -Headers $authHeaders -RequireAuth $true
$results += $o2
Write-Host "  GET /chat/sessions -> $($o2.Status) (HTTP $($o2.StatusCode)) [$($o2.ResponseTime)ms]"

$o3 = Test-Endpoint -Method GET -Endpoint "/quiz/unit/1" -Description "Get Quiz by Unit" -Headers $authHeaders -RequireAuth $true
$results += $o3
Write-Host "  GET /quiz/unit/1 -> $($o3.Status) (HTTP $($o3.StatusCode)) [$($o3.ResponseTime)ms]"

# ==================== RESULTS SUMMARY ====================
Write-Host ""
Write-Host "===============================================" -ForegroundColor Yellow
Write-Host "SUMMARY" -ForegroundColor Yellow
Write-Host "===============================================" -ForegroundColor Yellow

$passCount = ($results | Where-Object { $_.Status -eq "PASS" }).Count
$failCount = ($results | Where-Object { $_.Status -eq "FAIL" }).Count
$errorCount = ($results | Where-Object { $_.Status -eq "ERROR" }).Count
$totalCount = $results.Count

Write-Host ""
Write-Host "Total Tests: $totalCount" -ForegroundColor White
Write-Host "Passed: $passCount" -ForegroundColor Green
Write-Host "Failed: $failCount" -ForegroundColor Red
Write-Host "Errors: $errorCount" -ForegroundColor Yellow
Write-Host ""

if ($passCount -gt 0) {
    Write-Host "WORKING ENDPOINTS:" -ForegroundColor Green
    $results | Where-Object { $_.Status -eq "PASS" } | ForEach-Object {
        Write-Host "  [OK] $($_.Method) $($_.Endpoint)" -ForegroundColor Green
    }
}

if ($failCount -gt 0) {
    Write-Host "`nFAILED ENDPOINTS:" -ForegroundColor Red
    $results | Where-Object { $_.Status -eq "FAIL" } | ForEach-Object {
        Write-Host "  [FAIL] $($_.Method) $($_.Endpoint) - HTTP $($_.StatusCode)" -ForegroundColor Red
        if ($_.Error) {
            Write-Host "         Error: $($_.Error)" -ForegroundColor DarkRed
        }
    }
}

if ($errorCount -gt 0) {
    Write-Host "`nERROR ENDPOINTS:" -ForegroundColor Yellow
    $results | Where-Object { $_.Status -eq "ERROR" } | ForEach-Object {
        Write-Host "  [ERROR] $($_.Method) $($_.Endpoint)" -ForegroundColor Yellow
        Write-Host "          $($_.Error)" -ForegroundColor DarkYellow
    }
}

Write-Host ""
Write-Host "Success Rate: $([math]::Round(($passCount/$totalCount)*100,2))%" -ForegroundColor White
Write-Host "Average Response Time: $([math]::Round(($results | Measure-Object ResponseTime -Average).Average,2))ms" -ForegroundColor White

# Export detailed results
$exportPath = "C:\Users\user\medical\api-detailed-test-results.json"
$results | ConvertTo-Json -Depth 5 | Out-File -FilePath $exportPath -Force
Write-Host "`nDetailed results saved to: $exportPath" -ForegroundColor Gray

Write-Host ""
Write-Host "===============================================" -ForegroundColor Cyan
