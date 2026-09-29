const express = require('express');
const router = express.Router();

const { adminDashboardController } = require('../../../controllers');
const { adminAuthMiddleware } = require('../../../middlewares');


router.get('/counts', [adminAuthMiddleware.validateJWTtoken], adminDashboardController.getDashboardCounts);

module.exports = router;