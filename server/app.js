const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const errorHandler = require('./middleware/errorMiddleware');
const ApiResponse = require('./utils/apiResponse');
const authRoutes = require('./routes/authRoutes');
const orgRoutes = require('./routes/orgRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const trainingRoutes = require('./routes/trainingRoutes');
const mediaRoutes = require('./routes/mediaRoutes');
const quizRoutes = require('./routes/quizRoutes');
const assignmentRoutes = require('./routes/assignmentRoutes');
const trainingAssignmentRoutes = require('./routes/trainingAssignmentRoutes');
const progressRoutes = require('./routes/progressRoutes');
const notificationRoutes = require('./routes/notificationRoutes');
const reportRoutes = require('./routes/reportRoutes');
const auditLogRoutes = require('./routes/auditLogRoutes');
const certificateRoutes = require('./routes/certificateRoutes');
const superAdminRoutes = require('./routes/superAdminRoutes');

const { cacheMiddleware, invalidateServerCache } = require('./middleware/cacheMiddleware');

const app = express();

// Performance logging middleware for API response times
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const url = req.originalUrl || req.url || '';
    if (url.startsWith('/api') && !url.startsWith('/api/health')) {
      const duration = Date.now() - start;
      console.log(`[PERF] ${req.method} ${url} - ${duration} ms`);
    }
  });
  next();
});

app.set('trust proxy', 1);

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:5173',
  credentials: true,
  maxAge: 86400
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());
app.use(invalidateServerCache);

// Serve uploads directory statically for local media storage fallback
app.use('/uploads', express.static(path.join(__dirname, 'public/uploads')));

// Health Check Endpoint
app.get('/api/health', (req, res) => {
  res.status(200).json(new ApiResponse(200, { status: 'healthy', timestamp: new Date() }, 'Server is operational'));
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/super-admin', superAdminRoutes);
app.use('/api/org', orgRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/trainings', trainingRoutes);
app.use('/api/media', mediaRoutes);
app.use('/api/quizzes', quizRoutes);
app.use('/api/assignments', assignmentRoutes);
app.use('/api/assignments-engine', trainingAssignmentRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/audit-logs', auditLogRoutes);
app.use('/api/certificates', certificateRoutes);

// Global Error Handler
app.use(errorHandler);

module.exports = app;
