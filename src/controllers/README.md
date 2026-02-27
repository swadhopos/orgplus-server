# Controllers

This directory contains all controller modules for the OrgPlus backend API.

## Overview

Controllers handle the business logic for API endpoints. They:
- Process incoming requests
- Validate input data
- Interact with Firebase and MongoDB
- Return appropriate responses
- Handle errors consistently

## Available Controllers

### authController.js

Handles authentication-related operations.

**Endpoints:**
- `POST /api/auth/bootstrap` - Bootstrap system admin user

#### Bootstrap Endpoint

Creates the initial system admin user for the system.

**Email:** nksuhail13@gmail.com  
**Role:** systemAdmin  
**Password:** Set via `BOOTSTRAP_PASSWORD` environment variable

**Behavior:**
1. Checks if a system admin already exists
2. If user exists with systemAdmin role → Returns 409 Conflict
3. If user exists without systemAdmin role → Upgrades to systemAdmin
4. If user doesn't exist → Creates new user with systemAdmin role

**Response (201 Created):**
```json
{
  "success": true,
  "message": "System admin user created successfully",
  "data": {
    "userId": "firebase-uid",
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

**Logging:**
- Logs all bootstrap attempts with timestamp
- Logs successful completions with user details
- Logs failures with error details

**Security Note:**
In production, this endpoint should be:
- Protected by IP whitelist or VPN
- Disabled after initial setup
- Monitored for unauthorized access attempts

## Controller Structure

All controllers follow this pattern:

```javascript
export const controllerFunction = async (req, res, next) => {
  try {
    // 1. Extract and validate input
    // 2. Perform business logic
    // 3. Return success response
  } catch (error) {
    // 4. Log error
    // 5. Pass to error handler middleware
    next(error);
  }
};
```

## Error Handling

Controllers use custom error classes from `src/utils/errors.js`:
- `ValidationError` (400) - Invalid input
- `AuthenticationError` (401) - Auth failure
- `AuthorizationError` (403) - Permission denied
- `NotFoundError` (404) - Resource not found
- `ConflictError` (409) - Data conflict
- `InternalError` (500) - Server error

## Testing

Each controller has corresponding tests in `__tests__/` directory.

Run tests:
```bash
npm test -- src/controllers/__tests__/authController.test.js
```

## Future Controllers

The following controllers will be implemented in subsequent tasks:
- `organizationController.js` - Organization CRUD
- `householdController.js` - Household CRUD with user creation
- `memberController.js` - Member CRUD and relationships
- `committeeController.js` - Committee and committee member management
- `meetingController.js` - Meeting and attendance management
