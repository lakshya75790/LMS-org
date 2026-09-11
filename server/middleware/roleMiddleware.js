const ApiError = require('../utils/apiError');

const authorizeRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Role (${req.user ? req.user.role : 'Guest'}) is not authorized to access this resource`
        )
      );
    }
    next();
  };
};

module.exports = { authorizeRoles };
