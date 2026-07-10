# Test Notifications Endpoints
# This script tests the notification endpoints for the Medical Tracker API

Write-Host "=== Testing Medical Tracker Notifications API ===" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:3002/v1"
$frontendUrl = "http://localhost:3000"

# Step 1: Login to get access token
Write-Host "Step 1: Logging in as kerichomogul..." -ForegroundColor Yellow
$loginBody = @{
    email = "aaronrono427@gmail.com"
    password = "AU110s/6081/2021MTH"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$baseUrl/auth/login" -Method Post -Body $loginBody -ContentType "application/json"
    $accessToken = $loginResponse.data.accessToken
    
    if ($accessToken) {
        Write-Host "✓ Login successful!" -ForegroundColor Green
        Write-Host "Access Token: $($accessToken.Substring(0, 20))..." -ForegroundColor Gray
        Write-Host "User: $($loginResponse.data.user.username) ($($loginResponse.data.user.role))" -ForegroundColor Gray
    } else {
        Write-Host "✗ Login failed - no access token returned" -ForegroundColor Red
        Write-Host "Response: $($loginResponse | ConvertTo-Json)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "✗ Login failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Error Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Step 2: Get notifications from backend
Write-Host "Step 2: Fetching notifications from backend..." -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/notifications" -Method Get -Headers $headers
    Write-Host "✓ Successfully fetched notifications!" -ForegroundColor Green
    
    # Extract notifications array from wrapped response
    $notifications = $response.data
    
    if ($notifications -and $notifications.Count -gt 0) {
        Write-Host "Total notifications: $($notifications.Count)" -ForegroundColor Cyan
        Write-Host ""
        Write-Host "First 5 notifications:" -ForegroundColor Cyan
        $notifications | Select-Object -First 5 | ForEach-Object {
            Write-Host "  - [$($_.type)] $($_.message.Substring(0, [Math]::Min(50, $_.message.Length)))..." -ForegroundColor White
            Write-Host "    ID: $($_.id) | Read: $($_.read)" -ForegroundColor Gray
        }
    } else {
        Write-Host "No notifications found" -ForegroundColor Yellow
    }
} catch {
    Write-Host "✗ Failed to fetch notifications: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host "Error Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
}

Write-Host ""

# Step 3: Test mark as read
Write-Host "Step 3: Testing mark notification as read..." -ForegroundColor Yellow
if ($notifications -and $notifications.Count -gt 0) {
    $notifId = $notifications[0].id
    try {
        $markReadResponse = Invoke-RestMethod -Uri "$baseUrl/notifications/$notifId/read" -Method Patch -Headers $headers
        Write-Host "✓ Successfully marked notification as read!" -ForegroundColor Green
        Write-Host "Response: $($markReadResponse | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
    } catch {
        Write-Host "✗ Failed to mark as read: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host "Error Details: $($_.ErrorDetails.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⊘ Skipped - no notifications available" -ForegroundColor Yellow
}

Write-Host ""

# Step 4: Test frontend health check
Write-Host "Step 4: Testing frontend server health..." -ForegroundColor Yellow
try {
    $healthCheck = Invoke-RestMethod -Uri "$frontendUrl/api/health" -Method Get
    Write-Host "✓ Frontend server is running!" -ForegroundColor Green
    Write-Host "Health: $($healthCheck | ConvertTo-Json -Depth 1)" -ForegroundColor Gray
} catch {
    Write-Host "⊘ Frontend server not running on port 3000 or health check failed" -ForegroundColor Yellow
    Write-Host "Error: $($_.Exception.Message)" -ForegroundColor Gray
}

Write-Host ""

# Step 5: Test frontend API proxy for notifications
Write-Host "Step 5: Testing frontend API proxy for notifications..." -ForegroundColor Yellow
Write-Host "Note: This requires the frontend server to be running on port 3000" -ForegroundColor Gray

# Try with Bearer token in Authorization header
$frontendHeaders = @{
    "Authorization" = "Bearer $accessToken"
    "Content-Type" = "application/json"
}

Write-Host "Attempting frontend API call with Bearer token..." -ForegroundColor Gray
try {
    $frontendResponse = Invoke-RestMethod -Uri "$frontendUrl/api/notifications" -Method Get -Headers $frontendHeaders -ErrorAction Stop
    Write-Host "✓ Frontend API proxy working!" -ForegroundColor Green
    
    # Extract notifications from response if wrapped
    $frontendNotifs = if ($frontendResponse.data) { $frontendResponse.data } else { $frontendResponse }
    $notifCount = if ($frontendNotifs -is [array]) { $frontendNotifs.Count } else { 1 }
    Write-Host "Notifications count: $notifCount" -ForegroundColor Cyan
} catch {
    $errorMsg = $_.Exception.Message
    if ($errorMsg -match "404") {
        Write-Host "✗ Frontend API returning 404 - ensure frontend is restarted after code changes" -ForegroundColor Red
        Write-Host "   Try: cd frontend && npm run dev (in a separate terminal)" -ForegroundColor Yellow
    } elseif ($errorMsg -match "Unable to connect") {
        Write-Host "⊘ Frontend server not running on port 3000" -ForegroundColor Yellow
        Write-Host "   Try: cd frontend && npm run dev" -ForegroundColor Yellow
    } else {
        Write-Host "✗ Frontend API error: $errorMsg" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "=== Test Complete ===" -ForegroundColor Cyan

# Step 6: Test frontend mark-as-read via proxy
Write-Host "" 
Write-Host "Step 6: Testing frontend mark-as-read via proxy..." -ForegroundColor Yellow
if ($frontendNotifs -and $frontendNotifs.Count -gt 0) {
    $fId = $frontendNotifs[0].id
    try {
        $markResp = Invoke-RestMethod -Uri "$frontendUrl/api/notifications/$fId/read" -Method Patch -Headers $frontendHeaders -ErrorAction Stop
        Write-Host "✓ Frontend mark-as-read response:" -ForegroundColor Green
        Write-Host "$($markResp | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
    } catch {
        Write-Host "✗ Frontend mark-as-read failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⊘ Skipped - no frontend notifications" -ForegroundColor Yellow
}

# Step 7: Test frontend delete via proxy
Write-Host "" 
Write-Host "Step 7: Testing frontend delete via proxy..." -ForegroundColor Yellow
if ($frontendNotifs -and $frontendNotifs.Count -gt 0) {
    $delId = $frontendNotifs[0].id
    try {
        $delResp = Invoke-RestMethod -Uri "$frontendUrl/api/notifications/$delId" -Method Delete -Headers $frontendHeaders -ErrorAction Stop
        Write-Host "✓ Frontend delete response:" -ForegroundColor Green
        Write-Host "$($delResp | ConvertTo-Json -Depth 2)" -ForegroundColor Gray
    } catch {
        Write-Host "✗ Frontend delete failed: $($_.Exception.Message)" -ForegroundColor Red
    }
} else {
    Write-Host "⊘ Skipped - no frontend notifications" -ForegroundColor Yellow
}
