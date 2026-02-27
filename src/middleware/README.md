# Middleware Documentation

## Authentication Middleware

### Overview

The authentication middleware (`auth.js`) verifies Firebase ID tokens and extracts user information for use in downstream middleware and controllers.

### Usage

#### Required Authentication

Use `authenticateToken` for endpoints that require authentication:

```javascript
import { authenticateToken } from './middleware/auth.js';

router.get('/api/protected', authenticateToken, (req, res) => {
  // req.user is available here
  console.log(req.user.uid);
  console.log(req.user.role);
  res.json({ message: 'Authenticated!' });
});
```

#### Optional Authentication

Use `authenticateTokenOptional` for endpoints where authentication is optional:

```javascript
import { authenticateTokenOptional } from './middleware/auth.js';

router.get('/api/public', authenticateTokenOptional, (req, res) => {
  if (req.user) {
    // User is authenticated
    res.json({ message: `Hello ${req.user.email}` });
  } else {
    // User is not authenticated
    res.json({ message: 'Hello guest' });
  }
});
```

### Request User Object

After successful authentication, `req.user` contains:

```javascript
{
  uid: string,           // Firebase user ID
  email: string | null,  // User email
  role: string | null,   // User role (systemAdmin, admin, orgMember)
  orgId: string | null,  // Organization ID (for admin and orgMember)
  householdId: string | null  // Household ID (for orgMember only)
}
```

### Error Handling

The middleware returns `AuthenticationError` (401) for:
- Missing Authorization header
- Invalid header format (not "Bearer <token>")
- Empty token
- Expired token
- Revoked token
- Invalid token
- Malformed token

### Client Integration

Clients should include the Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

Example with fetch:

```javascript
const token = await firebase.auth().currentUser.getIdToken();

const response = await fetch('/api/protected', {
  headers: {
    'Authorization': `Bearer ${token}`
  }
});
```

### Testing

Run tests with:

```bash
npm test -- auth.test.js
```

The test suite covers:
- Missing/invalid authorization headers
- Token extraction
- Error handling for various Firebase errors
- Optional authentication behavior

---

## Authorization Middleware

### Overview

The authorization middleware (`authorize.js`) enforces role-based access control (RBAC) by checking user roles and organization access permissions. It must be used after the authentication middleware.

### Usage

#### Role-Based Authorization

Use `requireRole()` to restrict access to specific roles:

```javascript
import { authenticateToken } from './middleware/auth.js';
import { requireRole } from './middleware/authorize.js';

// Only system admins can create organizations
router.post('/api/organizations', 
  authenticateToken, 
  requireRole('systemAdmin'), 
  createOrganization
);

// Both system admins and organization admins can list households
router.get('/api/organizations/:orgId/households',
  authenticateToken,
  requireRole('systemAdmin', 'admin'),
  listHouseholds
);

// All authenticated users can access
router.get('/api/profile',
  authenticateToken,
  requireRole('systemAdmin', 'admin', 'orgMember'),
  getProfile
);
```

#### Organization Access Control

Use `requireOrgAccess` to ensure users can only access their assigned organization:

```javascript
import { authenticateToken } from './middleware/auth.js';
import { requireRole, requireOrgAccess } from './middleware/authorize.js';

// Ensure admin can only access their own organization
router.get('/api/organizations/:orgId/households',
  authenticateToken,
  requireRole('systemAdmin', 'admin'),
  requireOrgAccess,  // Verifies orgId matches user's organization
  listHouseholds
);
```

#### Middleware Chaining

Combine authentication, role check, and organization access:

```javascript
router.put('/api/organizations/:orgId/households/:id',
  authenticateToken,      // 1. Verify token and extract user info
  requireRole('admin'),   // 2. Check user has admin role
  requireOrgAccess,       // 3. Verify user can access this organization
  updateHousehold         // 4. Execute controller
);
```

### Role Hierarchy

The system supports three roles:

1. **systemAdmin**: Full system access, can access all organizations
2. **admin**: Organization-level access, can manage their assigned organization
3. **orgMember**: Household-level access, can access their household data (future use)

### Organization Access Rules

- **systemAdmin**: Can access any organization (bypasses `requireOrgAccess`)
- **admin**: Can only access their assigned organization (`req.user.orgId`)
- **orgMember**: Can only access their assigned organization

### Error Handling

The middleware returns `AuthorizationError` (403) for:
- User not authenticated
- User has no role assigned
- User role not in allowed roles
- User attempting to access different organization
- User has no organization assigned (for non-systemAdmin)
- Organization ID missing from request params

### Examples

#### Example 1: System Admin Only Endpoint

```javascript
// Only system admins can create organizations
router.post('/api/organizations',
  authenticateToken,
  requireRole('systemAdmin'),
  createOrganization
);
```

#### Example 2: Admin Accessing Own Organization

```javascript
// Admin can list households in their organization
router.get('/api/organizations/:orgId/households',
  authenticateToken,
  requireRole('admin'),
  requireOrgAccess,  // Ensures :orgId matches user's orgId
  listHouseholds
);
```

#### Example 3: Multiple Roles with Organization Access

```javascript
// System admin or organization admin can update household
router.put('/api/organizations/:orgId/households/:id',
  authenticateToken,
  requireRole('systemAdmin', 'admin'),
  requireOrgAccess,  // System admin bypasses this check
  updateHousehold
);
```

#### Example 4: All Roles Allowed

```javascript
// Any authenticated user can access their profile
router.get('/api/profile',
  authenticateToken,
  requireRole('systemAdmin', 'admin', 'orgMember'),
  getProfile
);
```

### Testing

Run tests with:

```bash
npm test -- authorize.test.js
```

The test suite covers:
- Authentication checks
- Single and multiple role requirements
- Role validation (case-sensitive)
- Organization access for all roles
- Parameter validation
- Organization ID matching
- Middleware chaining
- Error handling

---

## Request Logger Middleware

### Overview

The request logger middleware (`logger.js`) logs all incoming requests and responses for monitoring and debugging. It generates a unique request ID for each request, logs request details, and measures response time.

### Usage

Apply the middleware early in your middleware chain, before authentication:

```javascript
import requestLogger from './middleware/logger.js';
import { authenticateToken } from './middleware/auth.js';

// Apply to all routes
app.use(requestLogger);
app.use(authenticateToken);
```

### Features

#### Unique Request ID

Each request receives a unique UUID that:
- Is attached to `req.id`
- Is included in all log entries
- Is added to response headers as `X-Request-ID`
- Can be used for request tracing and debugging

#### Request Logging

Logs incoming requests with:
- Request type: 'request'
- Request ID
- HTTP method
- Path and full URL
- Query parameters
- User information (if authenticated)
- IP address
- User agent

#### Response Logging

Logs responses with:
- Response type: 'response'
- Request ID (matches request log)
- HTTP method and path
- Status code
- Duration in milliseconds
- User ID (if authenticated)

### Log Format

Request log example:

```json
{
  "type": "request",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "GET",
  "path": "/api/organizations",
  "url": "/api/organizations?page=1",
  "query": { "page": "1" },
  "userId": "user-123",
  "role": "admin",
  "orgId": "org-456",
  "ip": "192.168.1.100",
  "userAgent": "Mozilla/5.0...",
  "timestamp": "2024-01-15 10:30:45"
}
```

Response log example:

```json
{
  "type": "response",
  "requestId": "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
  "method": "GET",
  "path": "/api/organizations",
  "statusCode": 200,
  "duration": 45,
  "userId": "user-123",
  "timestamp": "2024-01-15 10:30:45"
}
```

### Request Tracing

Use the request ID for tracing requests across logs:

```javascript
// In your controller
logger.info('Processing organization creation', {
  requestId: req.id,
  organizationName: req.body.name
});
```

### Client Usage

Clients can retrieve the request ID from response headers:

```javascript
const response = await fetch('/api/organizations');
const requestId = response.headers.get('X-Request-ID');
console.log('Request ID:', requestId);
```

### Testing

Run tests with:

```bash
npm test -- logger.test.js
```

The test suite covers:
- Request ID generation and attachment
- Request logging with all fields
- Response logging with status codes and duration
- User information logging (authenticated and unauthenticated)
- Middleware flow and next() calling
- Edge cases (missing headers, different request types)

---

## Error Handler Middleware

See `errorHandler.js` for centralized error handling documentation.
