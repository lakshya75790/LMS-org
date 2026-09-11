const ApiError = require('../utils/apiError');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  if (statusCode !== 401 && statusCode !== 403 && statusCode !== 404) {
    console.error('API Error:', err);
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Resource not found. Invalid: ${err.path}`;
  }

  if (err.code === 11000) {
    statusCode = 400;
    const field = Object.keys(err.keyValue)[0];
    message = `Duplicate field value entered for ${field}`;
  }

  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = Object.values(err.errors).map(val => val.message).join(', ');
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token expired, please login again';
  }

  if (['P1001', 'P1017', 'P2024'].includes(err.code)) {
    statusCode = 503;
    message = 'Database service is temporarily unavailable. Please retry in a moment.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
};

module.exports = errorHandler;
