# Routes

This directory contains all route definitions for the OrgPlus backend API.

## Overview

Routes map HTTP endpoints to controller functions and apply appropriate middleware.

## Available Routes

### auth.js

Authentication routes for system bootstrap and user management.

**Base Path:** `/api/auth`

**Endpoints:**
- `POST /api/auth/bootstrap` - Bootstrap system admin user
  - Access: Public (should be protected in production)
  - Controller: `authController.bootstrap`
  - Middleware: None (no authentication required)

## Route Structure

All route files follow this pattern:

```javascript
import express from 'express';
import { controllerFunction } from '../controllers/controller.js';
import { authenticateToken } from '../middleware/auth.js';
import { requireRole } from '../middleware/authorize.js';

const router = express.Router();

// Public route
router.post('/public-endpoint', controllerFunction);

// Protected route with authentication
router.get('/protected-endpoint', 
  authenticateToken,
  controllerFunction
);

// Protected route with role-based authorization
router.post('/admin-endpoint',
  authenticateToken,
  requireRole('systemAdmin'),
  controllerFunction
);

export default router;
```

## Middleware Application

Routes apply middleware in this order:
1. **Request Logger** - Logs all requests (applied globally in app.js)
2. **Authentication** - Verifies Firebase token (`authenticateToken`)
3. **Authorization** - Checks role permissions (`requireRole`, `requireOrgAccess`)
4. **Tenant Filter** - Applies organization filtering (`applyTenantFilter`)
5. **Controller** - Executes business logic
6. **Error Handler** - Catches and formats errors (applied globally in app.js)

## Future Routes

The following route files will be implemented in subsequent tasks:
- `organizations.js` - Organization CRUD and admin creation
- `households.js` - Household CRUD with user creation
- `members.js` - Member CRUD and relationship queries
- `committees.js` - Committee and committee member management
- `meetings.js` - Meeting and attendance management

## Mounting Routes

Routes are mounted in `src/app.js` (or `src/server.js`):

```javascript
import authRoutes from './routes/auth.js';
import organizationRoutes from './routes/organizations.js';

app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);
```

## Testing Routes

Routes are tested through integration tests in controller test files.

Example:
```bash
npm test -- src/controllers/__tests__/authController.test.js
```

## API Documentation

For complete API documentation including request/response examples, see:
- Controller README files
- API documentation (to be created in Task 9.3)
