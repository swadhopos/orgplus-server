# OrgPlus Server

Backend API server for the OrgPlus multi-tenant organization management system.

## Tech Stack

- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: Firebase Admin SDK
- **Logging**: Winston
- **Validation**: Joi
- **Testing**: Jest + Supertest

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v6 or higher)
- Firebase project with Admin SDK credentials

## Setup Instructions

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   - Copy `.env.example` to `.env`
   - Update the values with your configuration:
     - MongoDB connection string
     - Firebase service account credentials
     - Server port and CORS origins

3. **Set up Firebase**:
   - Download your Firebase service account JSON file
   - Place it in the project root or specify the path in `.env`
   - Update `FIREBASE_SERVICE_ACCOUNT_PATH` in `.env`

4. **Start MongoDB**:
   ```bash
   # If using local MongoDB
   mongod
   ```

5. **Run the development server**:
   ```bash
   npm run dev
   ```

6. **Bootstrap the system admin**:
   ```bash
   curl -X POST http://localhost:5000/api/auth/bootstrap
   ```

## Available Scripts

- `npm start` - Start the production server
- `npm run dev` - Start the development server with auto-reload
- `npm test` - Run tests
- `npm run test:watch` - Run tests in watch mode
- `npm run lint` - Run ESLint

## Project Structure

```
orgplus-server/
├── src/
│   ├── config/          # Configuration files (Firebase, MongoDB)
│   ├── middleware/      # Express middleware (auth, authorization, logging)
│   ├── models/          # Mongoose models
│   ├── controllers/     # Route controllers
│   ├── routes/          # API routes
│   ├── utils/           # Utility functions and helpers
│   ├── app.js           # Express app setup
│   └── server.js        # Server entry point
├── logs/                # Application logs
├── .env                 # Environment variables (not in git)
├── .env.example         # Example environment variables
└── package.json
```

## API Documentation

The API follows RESTful conventions and uses JWT tokens from Firebase for authentication.

### Authentication

All protected endpoints require a Firebase token in the Authorization header:
```
Authorization: Bearer <firebase-token>
```

### Base URL

```
http://localhost:5000/api
```

### Endpoints

- `POST /api/auth/bootstrap` - Create initial system admin user
- `POST /api/organizations` - Create organization (systemAdmin only)
- `GET /api/organizations` - List organizations
- `POST /api/organizations/:orgId/admins` - Create organization admin
- And more... (see API documentation)

## Multi-Tenancy

The system implements strict tenant isolation:
- Each organization's data is segregated by `organizationId`
- System admins can access all organizations
- Organization admins can only access their assigned organization
- Automatic tenant filtering is applied via middleware

## Testing

Run the test suite:
```bash
npm test
```

Run tests with coverage:
```bash
npm test -- --coverage
```

## License

ISC
