const express = require("express");
const { tavController } = require("../../../controllers/Common");
const { anyAuthMiddleware } = require("../../../middlewares");
const router = express.Router();

router.post("/run-analysis", [anyAuthMiddleware.verifyUserOrAdmin], tavController.runTavAnalysis);

module.exports = router;
