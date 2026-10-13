const config = require('../config/config');
const allowedOrigins = config.accessDomains
  .split(',')
  .map((origin) => origin.trim().replace(/\/+$/, ''))
  .filter(Boolean);
module.exports = allowedOrigins;