# OrgPlus Server Setup Guide

## Prerequisites

- Node.js 18+ installed
- MongoDB running locally or connection string to MongoDB Atlas
- Firebase project with Admin SDK credentials

## Installation

1. Install dependencies:
```bash
npm install
```

2. Configure environment variables:
```bash
cp .env.example .env
```

Edit `.env` and set:
- `MONGODB_URI`: Your MongoDB connection string
- `FIREBASE_SERVICE_ACCOUNT_PATH`: Path to your Firebase service account JSON file
- `ALLOWED_ORIGINS`: Comma-separated list of allowed CORS origins
- `PORT`: Server port (default: 5000)

## Running the Server

### Development mode (with auto-reload):
```bash
npm run dev
```

### Production mode:
```bash
npm start
```

## Bootstrap System Admin

After starting the server, create the initial system admin user:

```bash
POST http://localhost:5000/api/auth/bootstrap
Content-Type: application/json

{
  "email": "nksuhail13@gmail.com",
  "password": "your-secure-password"
}
```

This creates a Firebase user with `systemAdmin` role.

## API Endpoints

### Authentication
- `POST /api/auth/bootstrap` - Create initial system admin

### Organizations (systemAdmin only)
- `POST /api/organizations` - Create organization
- `GET /api/organizations` - List organizations
- `GET /api/organizations/:id` - Get organization
- `PUT /api/organizations/:id` - Update organization
- `DELETE /api/organizations/:id` - Delete organization
- `POST /api/organizations/:orgId/admins` - Create org admin

### Households (admin/systemAdmin)
- `POST /api/organizations/:orgId/households` - Create household
- `GET /api/organizations/:orgId/households` - List households
- `GET /api/organizations/:orgId/households/:id` - Get household
- `PUT /api/organizations/:orgId/households/:id` - Update household
- `DELETE /api/organizations/:orgId/households/:id` - Delete household

### Members (admin/systemAdmin)
- `POST /api/organizations/:orgId/members` - Create member
- `GET /api/organizations/:orgId/members` - List members
- `GET /api/organizations/:orgId/members/:id` - Get member
- `GET /api/organizations/:orgId/members/:id/relationships` - Get relationships
- `PUT /api/organizations/:orgId/members/:id` - Update member
- `DELETE /api/organizations/:orgId/members/:id` - Delete member

### Committees (admin/systemAdmin)
- `POST /api/organizations/:orgId/committees` - Create committee
- `GET /api/organizations/:orgId/committees` - List committees
- `GET /api/organizations/:orgId/committees/:id` - Get committee
- `PUT /api/organizations/:orgId/committees/:id` - Update committee
- `DELETE /api/organizations/:orgId/committees/:id` - Delete committee
- `POST /api/organizations/:orgId/committees/:committeeId/members` - Add member
- `GET /api/organizations/:orgId/committees/:committeeId/members` - List members
- `PUT /api/organizations/:orgId/committees/:committeeId/members/:id` - Update member
- `DELETE /api/organizations/:orgId/committees/:committeeId/members/:id` - Remove member

### Meetings (admin/systemAdmin)
- `POST /api/organizations/:orgId/committees/:committeeId/meetings` - Create meeting
- `GET /api/organizations/:orgId/committees/:committeeId/meetings` - List meetings
- `GET /api/organizations/:orgId/committees/:committeeId/meetings/:id` - Get meeting
- `PUT /api/organizations/:orgId/committees/:committeeId/meetings/:id` - Update meeting
- `POST /api/organizations/:orgId/committees/:committeeId/meetings/:meetingId/attendance` - Record attendance
- `GET /api/organizations/:orgId/committees/:committeeId/meetings/:meetingId/attendance` - List attendance
- `PUT /api/organizations/:orgId/committees/:committeeId/meetings/attendance/:id` - Update attendance

## Authentication

All API requests (except bootstrap) require a Firebase ID token in the Authorization header:

```
Authorization: Bearer <firebase-id-token>
```

## Testing

Run tests:
```bash
npm test
```

Run tests in watch mode:
```bash
npm run test:watch
```

## Project Structure

```
orgplus-server/
├── src/
│   ├── config/          # Configuration files (Firebase, MongoDB)
│   ├── controllers/     # Request handlers
│   ├── middleware/      # Express middleware
│   ├── models/          # Mongoose models
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions
│   ├── app.js           # Express app setup
│   └── server.js        # Server entry point
├── logs/                # Application logs
├── .env                 # Environment variables
└── package.json
```

## Troubleshooting

### MongoDB Connection Issues
- Ensure MongoDB is running
- Check MONGODB_URI in .env
- Verify network connectivity

### Firebase Authentication Issues
- Verify Firebase service account file path
- Check Firebase project configuration
- Ensure service account has necessary permissions

### CORS Issues
- Add frontend URL to ALLOWED_ORIGINS in .env
- Restart server after changing environment variables
