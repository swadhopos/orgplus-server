# Error Handling Guide

This guide explains how to use the custom error classes and error handler middleware in the OrgPlus multi-tenant system.

## Custom Error Classes

All custom error classes extend the base `AppError` class and are designed for specific HTTP error scenarios.

### Available Error Classes

#### 1. ValidationError (400)
Used when request input validation fails.

```javascript
import { ValidationError } from './errors.js';

// Simple validation error
throw new ValidationError('Invalid input');

// With field-specific details
throw new ValidationError('Validation failed', [
  { field: 'email', message: 'Email is required' },
  { field: 'name', message: 'Name must be at least 3 characters' }
]);
```

#### 2. AuthenticationError (401)
Used when token verification fails or token is missing.

```javascript
import { AuthenticationError } from './errors.js';

throw new AuthenticationError('Invalid or expired token');
```

#### 3. AuthorizationError (403)
Used when user doesn't have permission to access a resource.

```javascript
import { AuthorizationError } from './errors.js';

throw new AuthorizationError('You do not have permission to access this organization');

// With details
throw new AuthorizationError('Insufficient permissions', { 
  required: 'systemAdmin',
  actual: 'admin'
});
```

#### 4. NotFoundError (404)
Used when a requested resource doesn't exist.

```javascript
import { NotFoundError } from './errors.js';

throw new NotFoundError('Organization not found');
```

#### 5. ConflictError (409)
Used when there's a conflict with existing data (e.g., duplicate unique field).

```javascript
import { ConflictError } from './errors.js';

throw new ConflictError('Organization name already exists', { 
  field: 'name',
  value: 'Acme Corp'
});
```

#### 6. InternalError (500)
Used for unexpected server errors.

```javascript
import { InternalError } from './errors.js';

throw new InternalError('Database connection failed');
```

## Using Errors in Controllers

### Example: Organization Controller

```javascript
import { 
  ValidationError, 
  NotFoundError, 
  ConflictError,
  AuthorizationError 
} from '../utils/errors.js';
import Organization from '../models/Organization.js';

export const createOrganization = async (req, res, next) => {
  try {
    // Check authorization
    if (req.user.role !== 'systemAdmin') {
      throw new AuthorizationError('Only system admins can create organizations');
    }

    // Validate input
    if (!req.body.name) {
      throw new ValidationError('Organization name is required', [
        { field: 'name', message: 'Name is required' }
      ]);
    }

    // Check for duplicates
    const existing = await Organization.findOne({ name: req.body.name });
    if (existing) {
      throw new ConflictError('Organization name already exists', {
        field: 'name',
        value: req.body.name
      });
    }

    // Create organization
    const organization = await Organization.create({
      ...req.body,
      createdByUserId: req.user.uid
    });

    res.status(201).json({ organization });
  } catch (error) {
    // Pass error to error handler middleware
    next(error);
  }
};

export const getOrganization = async (req, res, next) => {
  try {
    const organization = await Organization.findById(req.params.id);
    
    if (!organization) {
      throw new NotFoundError('Organization not found');
    }

    res.json({ organization });
  } catch (error) {
    next(error);
  }
};
```

## Error Handler Middleware

The error handler middleware automatically:
- Logs errors with request context
- Returns consistent error responses
- Handles both operational and programmer errors
- Hides internal error details in production

### Setting Up Error Handler

In your Express app:

```javascript
import express from 'express';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();

// ... your routes ...

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);
```

### Error Response Format

All errors return a consistent JSON format:

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Validation failed",
    "details": [
      { "field": "email", "message": "Email is required" }
    ],
    "requestId": "550e8400-e29b-41d4-a716-446655440000"
  }
}
```

### Error Codes

| Code | Status | Description |
|------|--------|-------------|
| VALIDATION_ERROR | 400 | Input validation failed |
| AUTHENTICATION_ERROR | 401 | Token verification failed |
| AUTHORIZATION_ERROR | 403 | Permission denied |
| NOT_FOUND | 404 | Resource not found |
| CONFLICT_ERROR | 409 | Resource conflict (duplicate) |
| INTERNAL_ERROR | 500 | Unexpected server error |
| ROUTE_NOT_FOUND | 404 | API route not found |

## Async Error Handling

For async route handlers, always wrap in try-catch and pass errors to `next()`:

```javascript
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

// Usage
app.get('/api/organizations', asyncHandler(async (req, res) => {
  const organizations = await Organization.find();
  res.json({ organizations });
}));
```

## Validation with Joi

Example of using Joi validation with custom errors:

```javascript
import Joi from 'joi';
import { ValidationError } from '../utils/errors.js';

const organizationSchema = Joi.object({
  name: Joi.string().required(),
  email: Joi.string().email().required(),
  phone: Joi.string().required()
});

export const validateOrganization = (req, res, next) => {
  const { error, value } = organizationSchema.validate(req.body, { 
    abortEarly: false 
  });
  
  if (error) {
    const details = error.details.map(d => ({
      field: d.path[0],
      message: d.message
    }));
    
    throw new ValidationError('Validation failed', details);
  }
  
  req.validatedData = value;
  next();
};
```

## Best Practices

1. **Always use custom error classes** instead of throwing generic Error objects
2. **Include helpful details** in error messages for debugging
3. **Pass errors to next()** in async handlers to ensure proper error handling
4. **Don't expose sensitive information** in error messages
5. **Use appropriate error types** for different scenarios
6. **Log errors with context** (request ID, user ID, etc.)
7. **Test error scenarios** in your unit and integration tests

## Testing Errors

Example test for error handling:

```javascript
import { ValidationError } from '../utils/errors.js';

describe('Organization Controller', () => {
  it('should throw ValidationError for missing name', async () => {
    const req = { body: {} };
    const res = {};
    const next = jest.fn();

    await createOrganization(req, res, next);

    expect(next).toHaveBeenCalledWith(
      expect.any(ValidationError)
    );
  });
});
```

## Operational vs Programmer Errors

- **Operational errors** (isOperational: true): Expected errors like validation failures, not found, etc.
- **Programmer errors** (isOperational: false): Unexpected errors like null reference, type errors, etc.

The error handler treats these differently:
- Operational errors: Full details exposed to client
- Programmer errors: Generic message in production, full details in development
