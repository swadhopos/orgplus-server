# API Testing Script for OrgPlus Multi-Tenant System
# Tests all endpoints with system admin credentials

$TOKEN = "eyJhbGciOiJSUzI1NiIsImtpZCI6IjJjMjdhZmY1YzlkNGU1MzVkNWRjMmMwNWM1YTE2N2FlMmY1NjgxYzIiLCJ0eXAiOiJKV1QifQ.eyJyb2xlIjoic3lzdGVtQWRtaW4iLCJpc3MiOiJodHRwczovL3NlY3VyZXRva2VuLmdvb2dsZS5jb20vb3JncGx1cy1iNDU4NSIsImF1ZCI6Im9yZ3BsdXMtYjQ1ODUiLCJhdXRoX3RpbWUiOjE3NzIyMDc2NzQsInVzZXJfaWQiOiJSNzBnd2dINWdVV3FQRzdWa05YMWNReG5kVHcyIiwic3ViIjoiUjcwZ3dnSDVnVVdxUEc3VmtOWDFjUXhuZFR3MiIsImlhdCI6MTc3MjIwNzY3NCwiZXhwIjoxNzcyMjExMjc0LCJlbWFpbCI6Im5rc3VoYWlsMTNAZ21haWwuY29tIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZpcmViYXNlIjp7ImlkZW50aXRpZXMiOnsiZW1haWwiOlsibmtzdWhhaWwxM0BnbWFpbC5jb20iXX0sInNpZ25faW5fcHJvdmlkZXIiOiJjdXN0b20ifX0.EQcMrskqR1W31xVIm6j2jc5W-9g7335CGzCHwKnjBKG9SttIZQNwuFt2Pll4FuhSVcSUk5YIKZE0xSapTZwxEhpox1a-976TaIFDYZ9jPyibR_FHJHwnrm4XtAFwXRoESfdfDltqWDVn_K3LqtKr1jlI8cj2J0i3ibw12Tarcv4qwEdKSlijKM4Op9191C8DIYX56pmz4Q4wIr5_dH3lSwx7i4jWXRpSG0zTwkaMuVsdHnYwhpiVv9h7INp9fH4jNOsIWuhoTYA8QlbGaxPXTdsrsAJAdvz32wZvsRzUfRDytxxeXisPKVERv28lg19WpThF_Uy52LIC-e1tu4_sSA"
$BASE_URL = "http://localhost:5000/api"
$HEADERS = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "OrgPlus API Testing Script" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Create Organization with Admin
Write-Host "TEST 1: Create Organization with Admin" -ForegroundColor Yellow
$orgBody = @{
    name = "Northside Community $(Get-Random -Maximum 9999)"
    address = "456 North Avenue, Bangalore"
    contactEmail = "northside@gmail.com"
    contactPhone = "+919876543210"
    status = "active"
    adminEmail = "northside.admin$(Get-Random -Maximum 9999)@gmail.com"
    adminPassword = "Admin@123456"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/organizations" -Method POST -Headers $HEADERS -Body $orgBody
    Write-Host "✅ Organization created successfully" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
    $ORG_ID = $response.data.organization._id
    Write-Host "`nOrganization ID: $ORG_ID" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    Write-Host $_.ErrorDetails.Message
}

Write-Host "`n----------------------------------------`n"

# Test 2: List Organizations
Write-Host "TEST 2: List Organizations" -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/organizations?page=1&limit=10" -Method GET -Headers $HEADERS
    Write-Host "✅ Organizations listed successfully" -ForegroundColor Green
    Write-Host ($response | ConvertTo-Json -Depth 5)
} catch {
    Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`n----------------------------------------`n"

# Test 3: Get Organization by ID
if ($ORG_ID) {
    Write-Host "TEST 3: Get Organization by ID" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/organizations/$ORG_ID" -Method GET -Headers $HEADERS
        Write-Host "✅ Organization retrieved successfully" -ForegroundColor Green
        Write-Host ($response | ConvertTo-Json -Depth 5)
    } catch {
        Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
    
    Write-Host "`n----------------------------------------`n"
    
    # Test 4: Update Organization
    Write-Host "TEST 4: Update Organization" -ForegroundColor Yellow
    $updateBody = @{
        contactPhone = "+919947371008"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/organizations/$ORG_ID" -Method PUT -Headers $HEADERS -Body $updateBody
        Write-Host "✅ Organization updated successfully" -ForegroundColor Green
        Write-Host ($response | ConvertTo-Json -Depth 5)
    } catch {
        Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n----------------------------------------`n"

# Test 5: Create Member (requires organization)
if ($ORG_ID) {
    Write-Host "TEST 5: Create Member" -ForegroundColor Yellow
    $memberBody = @{
        firstName = "John"
        lastName = "Doe"
        email = "john.doe@example.com"
        phone = "+919876543210"
        membershipNumber = "MEM001"
        membershipType = "regular"
        status = "active"
        organizationId = $ORG_ID
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/members" -Method POST -Headers $HEADERS -Body $memberBody
        Write-Host "✅ Member created successfully" -ForegroundColor Green
        Write-Host ($response | ConvertTo-Json -Depth 5)
        $MEMBER_ID = $response.data._id
    } catch {
        Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message
    }
    
    Write-Host "`n----------------------------------------`n"
    
    # Test 6: List Members
    Write-Host "TEST 6: List Members" -ForegroundColor Yellow
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/members?page=1&limit=10" -Method GET -Headers $HEADERS
        Write-Host "✅ Members listed successfully" -ForegroundColor Green
        Write-Host ($response | ConvertTo-Json -Depth 5)
    } catch {
        Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host "`n----------------------------------------`n"

# Test 7: Create Household
if ($ORG_ID -and $MEMBER_ID) {
    Write-Host "TEST 7: Create Household" -ForegroundColor Yellow
    $householdBody = @{
        householdNumber = "H001"
        address = "123 Main Street"
        primaryMemberId = $MEMBER_ID
        organizationId = $ORG_ID
        status = "active"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/households" -Method POST -Headers $HEADERS -Body $householdBody
        Write-Host "✅ Household created successfully" -ForegroundColor Green
        Write-Host ($response | ConvertTo-Json -Depth 5)
        $HOUSEHOLD_ID = $response.data._id
    } catch {
        Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message
    }
}

Write-Host "`n----------------------------------------`n"

# Test 8: Create Committee
if ($ORG_ID) {
    Write-Host "TEST 8: Create Committee" -ForegroundColor Yellow
    $committeeBody = @{
        name = "Management Committee"
        description = "Main management committee"
        organizationId = $ORG_ID
        status = "active"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/committees" -Method POST -Headers $HEADERS -Body $committeeBody
        Write-Host "✅ Committee created successfully" -ForegroundColor Green
        Write-Host ($response | ConvertTo-Json -Depth 5)
        $COMMITTEE_ID = $response.data._id
    } catch {
        Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message
    }
}

Write-Host "`n----------------------------------------`n"

# Test 9: Create Meeting
if ($ORG_ID -and $COMMITTEE_ID) {
    Write-Host "TEST 9: Create Meeting" -ForegroundColor Yellow
    $meetingBody = @{
        title = "Monthly General Meeting"
        description = "Regular monthly meeting"
        meetingDate = "2026-03-15T10:00:00Z"
        location = "Community Hall"
        committeeId = $COMMITTEE_ID
        organizationId = $ORG_ID
        status = "scheduled"
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/meetings" -Method POST -Headers $HEADERS -Body $meetingBody
        Write-Host "✅ Meeting created successfully" -ForegroundColor Green
        Write-Host ($response | ConvertTo-Json -Depth 5)
    } catch {
        Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        Write-Host $_.ErrorDetails.Message
    }
}

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "API Testing Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan
