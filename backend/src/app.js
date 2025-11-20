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
const corsOptions = {
  origin: (process.env.CORS_ORIGIN || '').split(',').map(origin => origin.trim()),
  credentials: process.env.CORS_CREDENTIALS === 'true',
  optionsSuccessStatus: 200,
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

// Apply rate limiting to all routes
app.use(generalLimiter);

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

