const app = require("./app.js");
const { DateTime } = require("luxon");
const config = require("./src/config/config.js");
const logger = require("./src/config/logger.js");

process.env.TZ = config.DEFAULT_TIMEZONE;

const currentTime = DateTime.now();

const server = app.listen(config.port, () => {
  logger.info(
    `Server is Working Fine 😊 & Listening to PORT: ${config.port} | ` +
      `Default Timezone is: ${process.env.TZ} | ` +
      `Current date and time: ${currentTime.toFormat("yyyy-MM-dd HH:mm:ss")}`,
  );
});

// Server exit operations
const exitHandler = () => {
  if (server) {
    server.close(() => {
      logger.info("Server closed");
      process.exit(1);
    });
  } else {
    process.exit(1);
  }
};

// Unexpected error handler
const unexpectedErrorHandler = (error) => {
  logger.error(error);
  exitHandler();
};

process.on("uncaughtException", unexpectedErrorHandler);
process.on("unhandledRejection", unexpectedErrorHandler);
process.on("SIGTERM", exitHandler);
