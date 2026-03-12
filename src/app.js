const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const { requestLogger } = require('./middleware/logger');
const errorHandler = require('./middleware/errorHandler');
const logger = require('./utils/logger');

// Import routes
const authRoutes = require('./routes/auth');
const organizationRoutes = require('./routes/organizations');
const householdRoutes = require('./routes/households');
const memberRoutes = require('./routes/members');
const committeeRoutes = require('./routes/committees');
const meetingRoutes = require('./routes/meetings');
const deathRegisterRoutes = require('./routes/deathRegisterRoutes');
const staffRoutes = require('./routes/staff');
const ledgerRoutes = require('./routes/ledger');
const eventRoutes = require('./routes/events');
const calendarRoutes = require('./routes/calendarRoutes');
const marriageNocRoutes = require('./routes/marriageNoc');
const marriageCertificateRoutes = require('./routes/marriageCertificate');
const orgSettingsRoutes = require('./routes/orgSettings');
const feeRoutes = require('./routes/fees');
const subscriptionRoutes = require('./routes/subscriptions');
const categoryRoutes = require('./routes/categories');

const app = express();

// Security middleware
app.use(helmet());

// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // Cache preflight for 10 minutes
};
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging middleware
app.use(requestLogger);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/organizations', organizationRoutes);

// Nested routes under organizations - Protected by Auth and Org Access
const { authenticateToken } = require('./middleware/auth');
const { requireOrgAccess } = require('./middleware/authorize');

app.use('/api/organizations/:orgId/households',
  authenticateToken,
  requireOrgAccess,
  householdRoutes
);

app.use('/api/organizations/:orgId/members',
  authenticateToken,
  requireOrgAccess,
  memberRoutes
);

app.use('/api/organizations/:orgId/committees',
  authenticateToken,
  requireOrgAccess,
  committeeRoutes
);

app.use('/api/organizations/:orgId/meetings',
  authenticateToken,
  requireOrgAccess,
  meetingRoutes
);

app.use('/api/organizations/:orgId/deaths',
  authenticateToken,
  requireOrgAccess,
  deathRegisterRoutes
);

app.use('/api/organizations/:orgId/staff',
  authenticateToken,
  requireOrgAccess,
  staffRoutes
);

app.use('/api/organizations/:orgId/ledgers',
  authenticateToken,
  requireOrgAccess,
  ledgerRoutes
);

app.use('/api/organizations/:orgId/events',
  authenticateToken,
  requireOrgAccess,
  eventRoutes
);

app.use('/api/organizations/:orgId/calendar',
  authenticateToken,
  requireOrgAccess,
  calendarRoutes
);

app.use('/api/organizations/:orgId/certificates/noc',
  authenticateToken,
  requireOrgAccess,
  marriageNocRoutes
);

app.use('/api/organizations/:orgId/certificates/marriage',
  authenticateToken,
  requireOrgAccess,
  marriageCertificateRoutes
);

app.use('/api/organizations/:orgId/settings',
  authenticateToken,
  requireOrgAccess,
  orgSettingsRoutes
);

app.use('/api/organizations/:orgId/fees',
  authenticateToken,
  requireOrgAccess,
  feeRoutes
);

app.use('/api/organizations/:orgId/subscriptions',
  authenticateToken,
  requireOrgAccess,
  subscriptionRoutes
);

app.use('/api/organizations/:orgId/categories',
  authenticateToken,
  requireOrgAccess,
  categoryRoutes
);

// Only mount meetings on the organization root
// Requests needing committee id should pass it in body for POST or query params for GET

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: 'Route not found'
    }
  });
});

// Error handler middleware (must be last)
app.use(errorHandler);

module.exports = app;
