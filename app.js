const express = require("express");
const helmet = require("helmet");
const cors = require("cors");
const compression = require("compression");
const httpStatus = require("http-status");
const path = require("path");
const fs = require("fs");
const moment = require("moment");
const app = express();

const config = require("./src/config/config.js");
const routes = require("./src/routes/v1");
const morgan = require("./src/config/morgan.js");
const { authLimiter } = require("./src/middlewares/rateLimiter.js");
const corsConfigs = require("./src/config/corsConfigs.js");
const ApiError = require("./src/utils/ApiError.js");
const errorHandler = require("./src/utils/errorHandler.js");
const responseWrapper = require("./src/config/responseWrapper");
const handleFileUploads = require("./src/config/multer.js");
const { paymentController } = require("./src/controllers/index.js");
const bodyParser = require("body-parser");

require("./src/models");

const PUBLIC_DIR = path.resolve(__dirname, "./public");

// Security headers
app.use(
  helmet.contentSecurityPolicy({
    useDefaults: true,
    directives: {
      "img-src": [
        "'self'",
        "data:",
        "*.google-analytics.com",
        "*.vimeocdn.com",
      ],
      "script-src": [
        "'self'",
        "*.polyfill.io",
        "'unsafe-eval'",
        "'unsafe-inline'",
      ],
      "default-src": [
        "'self'",
        "*.google-analytics.com",
        "*.gstatic.com",
        "*.googleapis.com",
        "vimeo.com",
        "*.vimeo.com",
      ],
    },
  }),
);

// Stripe webhook must receive the raw request body
app.post(
  "/api/v1/stripe/webhook/callback",
  bodyParser.raw({ type: "application/json" }),
  paymentController.stripeWebhook,
);

// Request body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Gzip compression
app.use(compression());

// HTTP request logging
if (config.env !== "test") {
  app.use(morgan.successHandler);
  app.use(morgan.errorHandler);
}

// Serve public files
app.use(express.static(PUBLIC_DIR));

// CORS
app.use(cors(corsConfigs));

// Limit repeated failed requests to auth endpoints
if (config.env === "production") {
  app.use("/v1/auth", authLimiter);
}

// Health check
app.get("/api/healthcheck", (req, res) => {
  res.status(200).send({
    response: "ok",
  });
});

// Test endpoint
app.get("/test", (req, res) => {
  res.status(200).send("Hello World !!");
});

// API routes
app.use("/api/v1", handleFileUploads, routes);

// Read current day's logs
app.get("/api/v1/logs", (req, res) => {
  const currentDate = moment().format("YYYY-MM-DD");
  const logFileName = `${currentDate}.log`;
  const logFilePath = path.join(__dirname, "logs", logFileName);

  fs.readFile(logFilePath, "utf8", (err, data) => {
    if (err) {
      return responseWrapper(res, [], "success");
    }

    const logs = data.split("\n");
    return responseWrapper(res, logs, "success");
  });
});

// Delete all log files
app.delete("/api/v1/logs", async (req, res) => {
  const logDirectory = path.join(__dirname, "logs");

  fs.readdir(logDirectory, async (err, files) => {
    if (err) {
      return responseWrapper(res, "", "Error reading log directory", 400);
    }

    files.forEach((file) => {
      if (file.endsWith(".log")) {
        fs.unlink(path.join(logDirectory, file), (err) => {
          if (err) {
            return responseWrapper(res, "", "Error deleting log file", 400);
          }
        });
      }
    });

    return responseWrapper(res, "", "All log files deleted successfully");
  });
});

// Public file APIs
app.use("/images", express.static(`${PUBLIC_DIR}/uploads/images`));

app.use("/videos", express.static(`${PUBLIC_DIR}/uploads/videos`));

app.use("/gifs", express.static(`${PUBLIC_DIR}/uploads/gifs`));

app.use("/docs", express.static(`${PUBLIC_DIR}/uploads/docs`));

app.use("/audios", express.static(`${PUBLIC_DIR}/uploads/audios`));

// 404 handler
app.use((req, res, next) => {
  next(new ApiError(httpStatus.NOT_FOUND, "Not found"));
});

// Error handler
app.use(errorHandler);

module.exports = app;
