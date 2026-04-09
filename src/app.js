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
const noticeRoutes = require('./routes/notices');
const fundraiserRoutes = require('./routes/fundraiserRoutes');
const nicheTypeRoutes = require('./routes/nicheTypes');
const transactionRoutes = require('./routes/transactionRoutes');
const analyticsRoutes = require('./routes/analyticsRoutes');
const publicRoutes = require('./routes/publicRoutes');
const customerRoutes = require('./routes/customer/index');
const supportTicketRoutes = require('./routes/supportTickets');
const adminSupportTicketRoutes = require('./routes/adminSupportTickets');

const app = express();

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: false, // Allow cross-origin images in dev
}));


// CORS configuration
const corsOptions = {
  origin: process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : '*',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-platform', 'x-device-id'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  maxAge: 600 // Cache preflight for 10 minutes
};
app.use(cors(corsOptions));

// Handle preflight requests explicitly
app.options('*', cors(corsOptions));

const rateLimit = require('express-rate-limit');
const path = require('path');

// Body parser middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting for auth routes
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 15, // Limit each IP to 15 requests per windowMs
  message: {
    success: false,
    error: {
      code: 'TOO_MANY_REQUESTS',
      message: 'Too many login attempts. Please try again after 15 minutes.'
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
});

// Serve uploads folder statically for local development
app.use('/uploads', express.static(path.join(process.cwd(), 'uploads')));

// Request logging middleware
app.use(requestLogger);

// Apply rate limiting to auth routes
app.use('/api/auth', authLimiter);
app.use('/api/customer/auth', authLimiter);


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
app.use('/api/admin/niche-types', nicheTypeRoutes);
app.use('/api/public', publicRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/admin/support-tickets', adminSupportTicketRoutes);

// Nested routes under organizations - Protected by Auth and Org Access
const { authenticateToken } = require('./middleware/auth');
const { requireOrgAccess } = require('./middleware/authorize');
const { requireFeature } = require('./middleware/featureAuth');

app.use('/api/organizations/:orgId/analytics',
  authenticateToken,
  requireOrgAccess,
  analyticsRoutes
);

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
  requireFeature('hasCommittees'),
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
  requireFeature('hasBMD'),
  deathRegisterRoutes
);

app.use('/api/organizations/:orgId/staff',
  authenticateToken,
  requireOrgAccess,
  requireFeature('hasStaff'),
  staffRoutes
);

app.use('/api/organizations/:orgId/ledgers',
  authenticateToken,
  requireOrgAccess,
  requireFeature('hasLedger'),
  ledgerRoutes
);

app.use('/api/organizations/:orgId/events',
  authenticateToken,
  requireOrgAccess,
  requireFeature('hasEvents'),
  eventRoutes
);

app.use('/api/organizations/:orgId/fundraisers',
  authenticateToken,
  requireOrgAccess,
  requireFeature('hasEvents'), // Using 'hasEvents' for both for now
  fundraiserRoutes
);

app.use('/api/organizations/:orgId/calendar',
  authenticateToken,
  requireOrgAccess,
  calendarRoutes
);

app.use('/api/organizations/:orgId/certificates/noc',
  authenticateToken,
  requireOrgAccess,
  requireFeature('hasBMD'),
  marriageNocRoutes
);

app.use('/api/organizations/:orgId/certificates/marriage',
  authenticateToken,
  requireOrgAccess,
  requireFeature('hasBMD'),
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
  requireFeature('hasSubscriptions'),
  feeRoutes
);

app.use('/api/organizations/:orgId/subscriptions',
  authenticateToken,
  requireOrgAccess,
  requireFeature('hasSubscriptions'),
  subscriptionRoutes
);

app.use('/api/organizations/:orgId/categories',
  authenticateToken,
  requireOrgAccess,
  categoryRoutes
);

app.use('/api/organizations/:orgId/notices',
  authenticateToken,
  requireOrgAccess,
  requireFeature('hasNotices'),
  noticeRoutes
);

app.use('/api/organizations/:orgId/transactions',
  authenticateToken,
  requireOrgAccess,
  transactionRoutes
);

app.use('/api/organizations/:orgId/support-tickets',
  authenticateToken,
  requireOrgAccess,
  supportTicketRoutes
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
