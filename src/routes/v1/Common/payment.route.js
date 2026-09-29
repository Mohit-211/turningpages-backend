const express = require('express');
const router = express.Router();

const { paymentController, subscriptionController } = require('../../../controllers');
const { adminAuthMiddleware, userAuthMiddleware } = require('../../../middlewares');

router.post('/intent/generate', [userAuthMiddleware.verifyAuthJWTToken], paymentController.getStripePaymentIntent);
router.get('/all', [userAuthMiddleware.verifyAuthJWTToken], paymentController.getAllPayments);
router.post('/details', [userAuthMiddleware.verifyAuthJWTToken], paymentController.getPaymentDetails);
router.get('/credit/list', [userAuthMiddleware.verifyAuthJWTToken], paymentController.getCreditSpentList);

router.get('/getAllPaymentList', paymentController.getAllPaymentList);

router.get('/getAllSubscriptions', subscriptionController.getAllSubscriptions);


//subscription apis
router.post('/subscription/create', [userAuthMiddleware.verifyAuthJWTToken], subscriptionController.createSubscription);
router.post('/subscription/upgrade', [userAuthMiddleware.verifyAuthJWTToken], subscriptionController.upgradeSubscription);
router.post('/subscription/cancel', [userAuthMiddleware.verifyAuthJWTToken], subscriptionController.cancelSubscription);
router.get('/getUserSubscriptions', [userAuthMiddleware.verifyAuthJWTToken], subscriptionController.getUserSubscriptions);

module.exports = router;