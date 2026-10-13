const express = require('express');
const router = express.Router();

const { userAuthController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');

router.post('/otp', userAuthController.sendOTP);
router.post('/verify-otp', userAuthController.verifyOTP);
router.post('/register', [userAuthMiddleware.validateRegisterUserBody, userAuthMiddleware.verifyCaptcha], userAuthController.register);

router.post('/login', [userAuthMiddleware.validateSignInReqBody], userAuthController.login);
router.post('/reset-password', [userAuthMiddleware.verifyAuthJWTToken, userAuthMiddleware.validateResetPassordBody], userAuthController.resetPassword);
router.post('/forgot-password', userAuthController.forgotPassword);
router.get('/logout', [userAuthMiddleware.verifyAuthJWTToken], userAuthController.logout);



module.exports = router;
