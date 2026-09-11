const jwt = require('jsonwebtoken');
const { withId } = require('../config/prismaClient');
const ApiError = require('../utils/apiError');

const protect = async (req, res, next) => {
  try {
    let token = req.cookies?.jwt;

    if (!token && req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      throw new ApiError(401, 'Not authorized, token missing');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    if (!decoded || !decoded.id) {
      throw new ApiError(401, 'Invalid authentication token');
    }

    req.user = withId({
      id: decoded.id,
      name: decoded.name,
      role: decoded.role,
      organizationId: decoded.organizationId
    });

    next();
  } catch (error) {
    next(error);
  }
};

module.exports = { protect };
