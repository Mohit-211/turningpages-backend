const { rateLimit } = require('express-rate-limit');
const config = require('../config/config');

const message = (msg) => ({ success: false, status: 429, message: msg, data: '' });

// Failed login/registration/reset attempts per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: config.authRateLimitMax,
  skipSuccessfulRequests: true,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many attempts. Please try again later.'),
});

// Every OTP send/verify request per IP, successful or not
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: message('Too many OTP requests. Please try again later.'),
});

module.exports = {
  authLimiter,
  otpLimiter,
};
