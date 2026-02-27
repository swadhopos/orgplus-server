# Test Backend Server Connection
Write-Host "Testing OrgPlus Backend Server..." -ForegroundColor Cyan
Write-Host ""

# Test if server is running
Write-Host "1. Testing if server is running on port 5000..." -ForegroundColor Yellow
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -UseBasicParsing -TimeoutSec 5
    Write-Host "✓ Server is running!" -ForegroundColor Green
    Write-Host "   Response: $($response.Content)" -ForegroundColor Gray
} catch {
    Write-Host "✗ Server is NOT running!" -ForegroundColor Red
    Write-Host "   Please start the server with: npm start" -ForegroundColor Yellow
    Write-Host ""
    exit 1
}

Write-Host ""
Write-Host "2. Testing MongoDB connection..." -ForegroundColor Yellow
Write-Host "   Check server logs for MongoDB connection status" -ForegroundColor Gray

Write-Host ""
Write-Host "✓ Backend server is ready!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Make sure MongoDB is running: mongod" -ForegroundColor White
Write-Host "2. Check server logs for any errors" -ForegroundColor White
Write-Host "3. Verify CORS settings allow http://localhost:5173" -ForegroundColor White
