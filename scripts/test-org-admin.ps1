# Test Organization Admin Login and Access
# Tests that org admin can login and access only their organization's data

$BASE_URL = "http://localhost:5000/api"
$ORG_ADMIN_EMAIL = "southside.admin@gmail.com"
$ORG_ADMIN_PASSWORD = "Admin@123456"
$ORG_ID = "69a1be7ccb8c066617ceb32f"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Organization Admin Access Test" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Step 1: Get Firebase custom token for org admin
Write-Host "STEP 1: Getting custom token for org admin..." -ForegroundColor Yellow
try {
    $getUserScript = @"
const { admin } = require('./src/config/firebase');
(async () => {
  try {
    const user = await admin.auth().getUserByEmail('$ORG_ADMIN_EMAIL');
    const token = await admin.auth().createCustomToken(user.uid);
    console.log(token);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
})();
"@
    
    $getUserScript | Out-File -FilePath "temp-get-token.js" -Encoding UTF8
    $customToken = node temp-get-token.js 2>&1 | Select-Object -Last 1
    Remove-Item "temp-get-token.js"
    
    Write-Host "✅ Custom token obtained" -ForegroundColor Green
} catch {
    Write-Host "❌ Failed to get custom token: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

# Step 2: Exchange custom token for ID token
Write-Host "`nSTEP 2: Exchanging custom token for ID token..." -ForegroundColor Yellow
try {
    $body = @{
        token = $customToken
        returnSecureToken = $true
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key=AIzaSyBgBGuxZ3rTzFJMMmP2yl8_GAqZjQi2eo0" -Method POST -Body $body -ContentType "application/json"
    $ID_TOKEN = $response.idToken
    
    Write-Host "✅ ID token obtained" -ForegroundColor Green
    Write-Host "User ID: $($response.localId)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed to get ID token: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

$HEADERS = @{
    "Authorization" = "Bearer $ID_TOKEN"
    "Content-Type" = "application/json"
}

Write-Host "`n----------------------------------------`n"

# Test 1: List Organizations (should only see their org)
Write-Host "TEST 1: List Organizations (Tenant Filtering)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/organizations" -Method GET -Headers $HEADERS
    Write-Host "✅ Organizations retrieved" -ForegroundColor Green
    Write-Host "Total organizations visible: $($response.data.Count)" -ForegroundColor Cyan
    
    if ($response.data.Count -eq 1 -and $response.data[0]._id -eq $ORG_ID) {
        Write-Host "✅ PASS: Org admin can only see their organization" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: Org admin can see other organizations!" -ForegroundColor Red
    }
    
    Write-Host ($response | ConvertTo-Json -Depth 3)
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.ErrorDetails.Message
}

Write-Host "`n----------------------------------------`n"

# Test 2: Get their own organization
Write-Host "TEST 2: Get Own Organization by ID" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/organizations/$ORG_ID" -Method GET -Headers $HEADERS
    Write-Host "✅ Organization retrieved successfully" -ForegroundColor Green
    Write-Host "Organization: $($response.data.name)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"

# Test 3: Try to access another organization (should fail)
Write-Host "TEST 3: Try to Access Another Organization (Should Fail)" -ForegroundColor Yellow
$OTHER_ORG_ID = "69a1bea0477cc7838ac3cb3a"
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/organizations/$OTHER_ORG_ID" -Method GET -Headers $HEADERS
    Write-Host "❌ FAIL: Org admin accessed another organization!" -ForegroundColor Red
    Write-Host ($response | ConvertTo-Json -Depth 3)
} catch {
    if ($_.Exception.Response.StatusCode -eq 404) {
        Write-Host "✅ PASS: Access denied to other organization (404 Not Found)" -ForegroundColor Green
    } else {
        Write-Host "⚠️  Unexpected error: $($_.Exception.Message)" -ForegroundColor Yellow
    }
}

Write-Host "`n----------------------------------------`n"

# Test 4: Create Member in their organization
Write-Host "TEST 4: Create Member in Own Organization" -ForegroundColor Yellow
$memberBody = @{
    firstName = "Test"
    lastName = "Member"
    email = "test.member@example.com"
    phone = "+919876543210"
    membershipNumber = "MEM$(Get-Random -Maximum 9999)"
    membershipType = "regular"
    status = "active"
    organizationId = $ORG_ID
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/members" -Method POST -Headers $HEADERS -Body $memberBody
    Write-Host "✅ Member created successfully" -ForegroundColor Green
    Write-Host "Member: $($response.data.firstName) $($response.data.lastName)" -ForegroundColor Cyan
    $MEMBER_ID = $response.data._id
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.ErrorDetails.Message
}

Write-Host "`n----------------------------------------`n"

# Test 5: List Members (should only see their org's members)
Write-Host "TEST 5: List Members (Tenant Filtering)" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/members" -Method GET -Headers $HEADERS
    Write-Host "✅ Members retrieved" -ForegroundColor Green
    Write-Host "Total members: $($response.data.Count)" -ForegroundColor Cyan
    
    # Check all members belong to their org
    $allBelongToOrg = $true
    foreach ($member in $response.data) {
        if ($member.organizationId -ne $ORG_ID) {
            $allBelongToOrg = $false
            break
        }
    }
    
    if ($allBelongToOrg) {
        Write-Host "✅ PASS: All members belong to org admin's organization" -ForegroundColor Green
    } else {
        Write-Host "❌ FAIL: Org admin can see members from other organizations!" -ForegroundColor Red
    }
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Organization Admin Test Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
