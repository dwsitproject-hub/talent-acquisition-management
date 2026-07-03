const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const compression = require('compression');
const fileUpload = require('express-fileupload');
const path = require('path');

const logger = require('./utils/logger');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');
const auditContextMiddleware = require('./middleware/auditContext');

// Import routes
const authRoutes = require('./routes/authRoutes');
const candidateRoutes = require('./routes/candidateRoutes');
const fptkRoutes = require('./routes/fptkRoutes');
const applicationRoutes = require('./routes/applicationRoutes');
const interviewRoutes = require('./routes/interviewRoutes');
const offerRoutes = require('./routes/offerRoutes');
const documentRoutes = require('./routes/documentRoutes');
const onboardingRoutes = require('./routes/onboardingRoutes');
const dashboardRoutes = require('./routes/dashboardRoutes');
const adminRoutes = require('./routes/adminRoutes');
const masterRoutes = require('./routes/masterRoutes');

const app = express();

// Trust proxy (for rate limiting and IP detection)
app.set('trust proxy', 1);
// Disable ETag to avoid 304 on frequently refreshed stats
app.set('etag', false);

// Request-scoped audit context (IP, user agent, authenticated user id)
app.use(auditContextMiddleware);

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", 'data:', 'https:'],
    },
  },
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true,
  },
}));

// CORS configuration
const allowedOrigins = (process.env.CORS_ORIGIN || 'http://localhost:4001,http://localhost:4002')
  .split(',')
  .map((origin) => origin.trim())
  .filter((origin) => origin.length > 0);

function normalizeOrigin(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function parseOriginToUrl(value) {
  try {
    return new URL(normalizeOrigin(value));
  } catch (e) {
    return null;
  }
}

// Support entries with or without an explicit port. If the allowed entry omits a port,
// we allow any port for that host+protocol (useful behind reverse proxies like :8080).
const allowedOriginMatchers = allowedOrigins
  .map((allowed) => {
    const allowedUrl = parseOriginToUrl(allowed);
    if (!allowedUrl) {
      const normalized = normalizeOrigin(allowed);
      return (incoming) => normalizeOrigin(incoming) === normalized;
    }

    const allowedProtocol = allowedUrl.protocol;
    const allowedHostname = allowedUrl.hostname;
    const allowedPort = allowedUrl.port; // '' means "no explicit port in config"

    return (incoming) => {
      const incomingUrl = parseOriginToUrl(incoming);
      if (!incomingUrl) return false;
      if (incomingUrl.protocol !== allowedProtocol) return false;
      if (incomingUrl.hostname !== allowedHostname) return false;
      if (allowedPort && incomingUrl.port !== allowedPort) return false;
      return true;
    };
  });

const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin is in allowed list (supports "any port" when config omits a port)
    if (allowedOriginMatchers.some((m) => m(origin))) {
      callback(null, true);
    } else {
      logger.warn(`CORS blocked request from origin: ${origin}`);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: process.env.CORS_CREDENTIALS === 'true' || true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
  optionsSuccessStatus: 200,
  preflightContinue: false,
};
app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Compression middleware
app.use(compression());

// File upload middleware
app.use(fileUpload({
  limits: { fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10 * 1024 * 1024 }, // 10MB
  abortOnLimit: true,
  createParentPath: true,
}));

// Logging middleware
if (process.env.NODE_ENV === 'development') {
  app.use(morgan('dev'));
} else {
  app.use(morgan('combined', {
    stream: {
      write: (message) => logger.info(message.trim()),
    },
  }));
}

// Static files (for uploaded documents)
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    port: process.env.PORT || 4000,
  });
});

// API routes
// Apply rate limiting to API routes (excludes /api/auth via limiter skip logic)
app.use('/api', generalLimiter);
app.use('/api/auth', authRoutes);
app.use('/api/candidates', candidateRoutes);
app.use('/api/fptk', fptkRoutes);
app.use('/api/applications', applicationRoutes);
app.use('/api/interviews', interviewRoutes);
app.use('/api/offers', offerRoutes);
app.use('/api/documents', documentRoutes);
app.use('/api/onboarding', onboardingRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/masters', masterRoutes);

// API documentation (simple version)
app.get('/api', (req, res) => {
  res.json({
    success: true,
    message: 'KPN Talent Acquisition System API',
    version: '1.0.0',
    endpoints: {
      auth: '/api/auth',
      candidates: '/api/candidates',
      fptk: '/api/fptk',
      applications: '/api/applications',
      interviews: '/api/interviews',
      offers: '/api/offers',
      documents: '/api/documents',
      onboarding: '/api/onboarding',
      dashboard: '/api/dashboard',
    },
    documentation: '/api-docs',
  });
});

// 404 handler
app.use(notFoundHandler);

// Global error handler
app.use(errorHandler);

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
  logger.error('Unhandled Promise Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  logger.error('Uncaught Exception:', err);
  process.exit(1);
});

module.exports = app;

