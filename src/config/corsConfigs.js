const allowedOrigins = require("../helpers/accessDomains");

const corsConfigs = {
  origin: (origin, callback) => {
    if (allowedOrigins.includes(origin) || !origin) {
      callback(null, true);
    } else {
      callback(new Error("Origin not allowed by CORS"));
    }
  },

  credentials: true,

  optionsSuccessStatus: 200,
};

module.exports = corsConfigs;
