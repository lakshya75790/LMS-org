const jwt = require('jsonwebtoken');

const generateTokenAndSetCookie = (res, userId, role, organizationId, name = '') => {
  const token = jwt.sign(
    { id: userId, role, organizationId: organizationId || null, name },
    process.env.JWT_SECRET,
    { expiresIn: '30d' }
  );

  const isProduction = process.env.NODE_ENV === 'production';

  const cookieOptions = {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? 'none' : 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
  };

  res.cookie('jwt', token, cookieOptions);

  return token;
};

module.exports = generateTokenAndSetCookie;
