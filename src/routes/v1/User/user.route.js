const express = require('express');
const router = express.Router();

const { userOpController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');


router.get('/profile', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getProfile);
router.post('/profile', [userAuthMiddleware.verifyAuthJWTToken], userOpController.updateProfile);
router.delete('/deactivate', [userAuthMiddleware.verifyAuthJWTToken], userOpController.deactivateAccount);
router.get('/dashboard/data', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getDashboardData);

router.post('/contact-us', userOpController.createContact);

router.get('/getUserCreditStats', [userAuthMiddleware.verifyAuthJWTToken], userOpController.getUserCreditStats);


module.exports = router;
