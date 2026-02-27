# MongoDB Database Configuration

## Overview

This module provides MongoDB connection management for the OrgPlus multi-tenant system using Mongoose. It includes connection pooling, retry logic with exponential backoff, and comprehensive event listeners.

## Features

### 1. Connection Pooling
- **Max Pool Size**: 10 connections
- **Min Pool Size**: 2 connections
- Efficient resource usage for concurrent requests
- Automatic connection reuse

### 2. Retry Logic with Exponential Backoff
- **Max Retries**: 5 attempts
- **Initial Delay**: 1 second
- **Backoff Strategy**: Exponential (1s, 2s, 4s, 8s, 16s)
- Automatic reconnection on failure

### 3. Event Listeners
- **connected**: Logs successful connection
- **error**: Logs connection errors
- **disconnected**: Logs disconnection events
- **SIGINT**: Graceful shutdown on application termination

## Configuration

### Environment Variables

Set the MongoDB URI in your `.env` file:

```env
MONGODB_URI=mongodb://localhost:27017/orgplus
```

For production with authentication:

```env
MONGODB_URI=mongodb://username:password@host:port/orgplus?authSource=admin
```

For MongoDB Atlas:

```env
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/orgplus?retryWrites=true&w=majority
```

## Usage

### Basic Usage

```javascript
import { initializeDatabase } from './config/database.js';

// Initialize database connection
await initializeDatabase();
```

### In Express Application

```javascript
import express from 'express';
import { initializeDatabase } from './config/database.js';

const app = express();

// Initialize database before starting server
const startServer = async () => {
  try {
    await initializeDatabase();
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
```

### Manual Connection Control

```javascript
import { 
  connectDB, 
  closeDatabase, 
  getConnectionStatus 
} from './config/database.js';

// Connect manually
await connectDB();

// Check connection status
const status = getConnectionStatus();
console.log('Connection status:', status);
// Output: connected, disconnected, connecting, or disconnecting

// Close connection
await closeDatabase();
```

## Testing

### Run Unit Tests

```bash
npm test -- src/config/__tests__/database.test.js
```

### Run Manual Test

```bash
node src/config/test-database.js
```

## Connection States

The connection can be in one of four states:

- **disconnected** (0): Not connected to MongoDB
- **connected** (1): Successfully connected
- **connecting** (2): Connection in progress
- **disconnecting** (3): Disconnection in progress

## Error Handling

### Connection Failures

If the initial connection fails, the module will:
1. Log the error with attempt number
2. Wait for exponential backoff delay
3. Retry up to 5 times
4. Throw error if all retries fail

### Runtime Errors

Connection errors during runtime are logged but don't crash the application. The event listeners will capture:
- Connection drops
- Network issues
- Authentication failures

## Graceful Shutdown

The module automatically handles graceful shutdown:

1. Listens for SIGINT signal (Ctrl+C)
2. Closes MongoDB connection
3. Logs shutdown message
4. Exits process cleanly

## Best Practices

1. **Always initialize before using models**: Call `initializeDatabase()` before any database operations
2. **Use environment variables**: Never hardcode connection strings
3. **Monitor connection status**: Use `getConnectionStatus()` for health checks
4. **Handle errors**: Wrap database operations in try-catch blocks
5. **Close connections in tests**: Always close connections in test cleanup

## Troubleshooting

### Connection Timeout

If you see timeout errors:
- Check MongoDB is running: `mongod --version`
- Verify connection string in `.env`
- Check network connectivity
- Ensure firewall allows MongoDB port (default: 27017)

### Authentication Errors

If you see authentication errors:
- Verify username and password
- Check user has correct permissions
- Ensure `authSource` is specified if needed

### Pool Exhaustion

If you see pool exhaustion warnings:
- Increase `maxPoolSize` in connection options
- Check for connection leaks in your code
- Ensure queries are properly closed

## Connection Options

Current configuration:

```javascript
{
  maxPoolSize: 10,        // Maximum connections in pool
  minPoolSize: 2,         // Minimum connections in pool
  serverSelectionTimeoutMS: 5000,  // Server selection timeout
  socketTimeoutMS: 45000,          // Socket operation timeout
  family: 4,              // Use IPv4
}
```

Adjust these in `src/config/database.js` based on your needs.

## Related Files

- `src/config/database.js` - Main database module
- `src/config/__tests__/database.test.js` - Unit tests
- `src/config/test-database.js` - Manual test script
- `.env` - Environment configuration

## References

- [Mongoose Documentation](https://mongoosejs.com/docs/)
- [MongoDB Connection String](https://docs.mongodb.com/manual/reference/connection-string/)
- [Connection Pooling](https://mongoosejs.com/docs/connections.html#connection-pools)
