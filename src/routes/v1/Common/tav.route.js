const express = require("express");
const { tavController } = require("../../../controllers/Common");
const { userAuthMiddleware } = require("../../../middlewares");
const router = express.Router();

router.post("/run-analysis", tavController.runTavAnalysis);

module.exports = router;
