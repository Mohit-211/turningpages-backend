const express = require('express');
const router = express.Router();

const {adminAuthController} = require('../../../controllers');
const {adminAuthMiddleware} = require('../../../middlewares');

router.post('/register', [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin, adminAuthMiddleware.validateCreateAdminBody], adminAuthController.createAdminUser);
router.post('/login', [adminAuthMiddleware.validateLoginAdminBody], adminAuthController.loginAdminUser);
router.post('/change-password',  [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.validateResetPassordBody], adminAuthController.resetAdminPassword);
router.post('/otp',  adminAuthController.sendOTP);
router.post('/verify-otp',  adminAuthController.verifyOTP);
router.post('/forgot-password',  adminAuthController.forgotAdminPassword);

router.get('/getProfile', [adminAuthMiddleware.validateJWTtoken], adminAuthController.getProfile);

module.exports = router;
