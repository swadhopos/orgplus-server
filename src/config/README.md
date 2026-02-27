# Firebase Admin SDK Configuration

This directory contains the Firebase Admin SDK configuration for the OrgPlus backend server.

## Overview

The Firebase Admin SDK is used for:
- Verifying Firebase ID tokens from client applications
- Creating Firebase users for organization admins and household members
- Setting custom claims for role-based access control
- Managing user authentication on the backend

## Configuration

### Option 1: Service Account File (Recommended)

Set the path to your Firebase service account JSON file in `.env`:

```env
FIREBASE_SERVICE_ACCOUNT_PATH=../orgplus-b4585-firebase-adminsdk-fbsvc-ad9d478edd.json
```

### Option 2: Environment Variables

For containerized deployments, you can use individual environment variables:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_PRIVATE_KEY=your-private-key
FIREBASE_CLIENT_EMAIL=your-client-email
```

## Usage

### Import the Firebase module

```javascript
import { 
  getFirebaseAdmin, 
  getAuth, 
  verifyIdToken,
  setCustomClaims,
  createUser,
  getUserByEmail,
  getUserByUid
} from './config/firebase.js';
```

### Verify ID Token

```javascript
try {
  const decodedToken = await verifyIdToken(idToken);
  console.log('User ID:', decodedToken.uid);
  console.log('Email:', decodedToken.email);
  console.log('Custom Claims:', decodedToken);
} catch (error) {
  console.error('Token verification failed:', error.message);
}
```

### Create User with Custom Claims

```javascript
// Create user
const userRecord = await createUser('user@example.com', 'password123');

// Set custom claims
await setCustomClaims(userRecord.uid, {
  role: 'admin',
  orgId: 'org123'
});
```

### Get User Information

```javascript
// By email
const user = await getUserByEmail('user@example.com');

// By UID
const user = await getUserByUid('user123');
```

## Custom Claims Structure

The system uses the following custom claims structure:

### System Admin
```javascript
{
  role: 'systemAdmin'
}
```

### Organization Admin
```javascript
{
  role: 'admin',
  orgId: 'organization_id'
}
```

### Organization Member (for future household member app)
```javascript
{
  role: 'orgMember',
  orgId: 'organization_id',
  householdId: 'household_id'
}
```

## Testing

### Basic Initialization Test

Run the basic test to verify Firebase is properly initialized:

```bash
node src/config/test-firebase-basic.js
```

This test verifies:
- Firebase Admin SDK initialization
- Project ID configuration
- Auth instance availability
- All exported functions are available

### Full Connection Test

Run the full test to verify Firebase connection and permissions:

```bash
node src/config/test-firebase.js
```

This test verifies:
- Firebase Admin SDK initialization
- Connection to Firebase Auth
- Ability to list users
- Bootstrap user existence

**Note:** The full test requires proper IAM permissions in Firebase Console.

### Unit Tests

Run the unit tests:

```bash
npm test -- src/config/__tests__/firebase.test.js
```

## Troubleshooting

### Firebase not initialized error

**Error:** `Firebase Admin SDK not initialized`

**Solution:** Ensure you have set either `FIREBASE_SERVICE_ACCOUNT_PATH` or the individual Firebase environment variables in your `.env` file.

### Service account file not found

**Error:** `ENOENT: no such file or directory`

**Solution:** Verify the path in `FIREBASE_SERVICE_ACCOUNT_PATH` is correct and the file exists.

### Permission denied errors

**Error:** `Caller does not have required permission`

**Solution:** The service account needs proper IAM roles in Firebase Console:
1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to Project Settings > Service Accounts
4. Ensure the service account has the required permissions:
   - Firebase Authentication Admin
   - Service Usage Consumer

### Invalid private key format

**Error:** `Invalid private key format`

**Solution:** If using environment variables, ensure the private key is properly escaped:
```env
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\nYour\nKey\nHere\n-----END PRIVATE KEY-----\n"
```

## Security Best Practices

1. **Never commit service account files to version control**
   - Add `*.json` to `.gitignore` for service account files
   - Use environment variables in production

2. **Restrict service account permissions**
   - Only grant necessary IAM roles
   - Use separate service accounts for different environments

3. **Rotate credentials regularly**
   - Generate new service account keys periodically
   - Revoke old keys after rotation

4. **Use environment-specific configurations**
   - Different service accounts for dev, staging, and production
   - Never use production credentials in development

## References

- [Firebase Admin SDK Documentation](https://firebase.google.com/docs/admin/setup)
- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Custom Claims](https://firebase.google.com/docs/auth/admin/custom-claims)
