# Bootstrap Endpoint Implementation

## Overview

The bootstrap endpoint creates the initial system admin user for the OrgPlus multi-tenant system. This is a critical security endpoint that should only be used once during system setup.

## Implementation Details

### Files Created

1. **src/controllers/authController.js**
   - Implements the `bootstrap` function
   - Handles system admin creation and validation
   - Comprehensive error handling and logging

2. **src/routes/auth.js**
   - Defines the POST /api/auth/bootstrap route
   - Maps route to controller function

3. **src/controllers/__tests__/authController.test.js**
   - 8 comprehensive integration tests
   - Tests all success and error scenarios
   - Validates logging behavior

### Bootstrap Logic

The bootstrap endpoint follows this flow:

```
1. Check if user with email nksuhail13@gmail.com exists
   ├─ User doesn't exist
   │  ├─ Create Firebase user
   │  ├─ Set custom claims { role: "systemAdmin" }
   │  └─ Return 201 Created
   │
   ├─ User exists with systemAdmin role
   │  └─ Return 409 Conflict (already bootstrapped)
   │
   └─ User exists without systemAdmin role
      ├─ Upgrade user to systemAdmin
      └─ Return 201 Created
```

### Configuration

**Environment Variables:**
- `BOOTSTRAP_PASSWORD` - Password for the system admin user (default: TempPassword123!)

**Bootstrap User:**
- Email: nksuhail13@gmail.com
- Role: systemAdmin
- Custom Claims: `{ role: "systemAdmin" }`

### API Specification

**Endpoint:** `POST /api/auth/bootstrap`

**Request:**
```http
POST /api/auth/bootstrap HTTP/1.1
Content-Type: application/json
```

**Success Response (201 Created):**
```json
{
  "success": true,
  "message": "System admin user created successfully",
  "data": {
    "userId": "firebase-uid-string",
    "email": "nksuhail13@gmail.com",
    "role": "systemAdmin"
  }
}
```

**Error Response (409 Conflict):**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_ERROR",
    "message": "System admin already exists. Bootstrap can only be performed once.",
    "details": {
      "email": "nksuhail13@gmail.com"
    }
  }
}
```

### Logging

The bootstrap endpoint logs the following events:

1. **Bootstrap Attempt Initiated**
   ```json
   {
     "level": "info",
     "message": "Bootstrap attempt initiated",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "requestId": "uuid"
   }
   ```

2. **Bootstrap Success**
   ```json
   {
     "level": "info",
     "message": "Bootstrap completed successfully",
     "userId": "firebase-uid",
     "email": "nksuhail13@gmail.com",
     "role": "systemAdmin",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "requestId": "uuid"
   }
   ```

3. **Bootstrap Rejection**
   ```json
   {
     "level": "warn",
     "message": "Bootstrap rejected: System admin already exists",
     "userId": "existing-uid",
     "email": "nksuhail13@gmail.com",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "requestId": "uuid"
   }
   ```

4. **Bootstrap Failure**
   ```json
   {
     "level": "error",
     "message": "Bootstrap failed",
     "error": "Error message",
     "stack": "Error stack trace",
     "timestamp": "2024-01-01T00:00:00.000Z",
     "requestId": "uuid"
   }
   ```

### Security Considerations

⚠️ **IMPORTANT:** This endpoint has no authentication requirements by design (it creates the first admin user). In production:

1. **Disable After Setup**
   - Remove the route after initial bootstrap
   - Or add environment check to disable in production

2. **Network Protection**
   - Restrict access via IP whitelist
   - Use VPN or private network
   - Add firewall rules

3. **Monitoring**
   - Monitor all bootstrap attempts
   - Alert on multiple failed attempts
   - Track successful bootstraps

4. **Password Security**
   - Use strong BOOTSTRAP_PASSWORD
   - Change password immediately after first login
   - Store password securely (not in version control)

### Testing

Run the bootstrap endpoint tests:

```bash
npm test -- src/controllers/__tests__/authController.test.js
```

**Test Coverage:**
- ✅ Create system admin when no user exists
- ✅ Upgrade existing user without systemAdmin role
- ✅ Reject when system admin already exists
- ✅ Handle Firebase user creation errors
- ✅ Handle custom claims setting errors
- ✅ Log bootstrap attempt
- ✅ Log successful completion
- ✅ Log bootstrap failure

All 8 tests passing ✓

### Usage Example

**First Time Setup:**
```bash
curl -X POST http://localhost:5000/api/auth/bootstrap
```

**Response:**
```json
{
  "success": true,
  "message": "System admin user created successfully",
  "data": {
    "userId": "abc123xyz",
    "email": "nksuhail13@gmail.com",
    "role": "systemAdmin"
  }
}
```

**Subsequent Attempts:**
```bash
curl -X POST http://localhost:5000/api/auth/bootstrap
```

**Response:**
```json
{
  "success": false,
  "error": {
    "code": "CONFLICT_ERROR",
    "message": "System admin already exists. Bootstrap can only be performed once.",
    "details": {
      "email": "nksuhail13@gmail.com"
    }
  }
}
```

### Next Steps

After bootstrapping:

1. **Login as System Admin**
   - Use Firebase Auth to login with nksuhail13@gmail.com
   - Change password immediately

2. **Create Organizations**
   - Use POST /api/organizations endpoint (Task 4.1)
   - Requires systemAdmin role

3. **Create Organization Admins**
   - Use POST /api/organizations/:orgId/admins endpoint (Task 4.1)
   - Requires systemAdmin role

4. **Secure the Bootstrap Endpoint**
   - Disable or remove the route
   - Add network-level protection

## Task Completion

✅ All acceptance criteria met:
- Created `src/controllers/authController.js`
- Implemented `bootstrap` function
- Checks if system admin already exists
- Creates Firebase user with email nksuhail13@gmail.com
- Sets custom claims `{ role: "systemAdmin" }`
- Returns user ID and email
- Logs bootstrap attempts
- Added integration tests (8 tests, all passing)

**Status:** Task 2.5 Complete ✓
