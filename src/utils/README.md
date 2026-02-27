# Utilities

## Logger

The logger utility provides structured logging using Winston with file and console transports.

### Features

- **Multiple log levels**: error, warn, info, debug
- **File transports**: 
  - `logs/error.log` - Only error level logs
  - `logs/combined.log` - All log levels
- **Console transport**: Enabled in non-production environments with colorized output
- **Request ID generation**: UUID v4 for tracking requests
- **Child loggers**: Create request-scoped loggers with automatic request ID inclusion

### Usage

```javascript
import { logger, generateRequestId, createRequestLogger } from './utils/logger.js';

// Basic logging
logger.info('Application started');
logger.error('An error occurred', { error: err.message });

// Generate request ID
const requestId = generateRequestId();

// Create request-scoped logger
const requestLogger = createRequestLogger(requestId);
requestLogger.info('Request received', { method: 'GET', path: '/api/users' });
requestLogger.info('Request completed', { statusCode: 200, duration: 45 });
```

### Configuration

Set the log level via environment variable:

```bash
LOG_LEVEL=debug  # Options: error, warn, info, debug
```

### Log Format

**File logs** (JSON format):
```json
{"level":"info","message":"Request received","method":"GET","path":"/api/users","requestId":"74f96106-1144-4ecc-a589-a21c0aeca17d","timestamp":"2026-02-27 17:33:11"}
```

**Console logs** (human-readable format):
```
2026-02-27 17:33:11 [info]: Request received {"method":"GET","path":"/api/users","requestId":"74f96106-1144-4ecc-a589-a21c0aeca17d"}
```

### Log Rotation

Log files are automatically rotated when they reach 5MB, keeping up to 5 backup files.
