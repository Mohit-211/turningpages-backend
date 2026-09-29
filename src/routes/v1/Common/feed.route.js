const express = require('express');
const router = express.Router();

const { feedController } = require('../../../controllers');
const { userAuthMiddleware } = require('../../../middlewares');


/**
 * ===============================
 * FEED ROUTES
 * ===============================
 */

// Create Feed
router.post(
    '/',
    [userAuthMiddleware.verifyAuthJWTToken],
    feedController.createFeed
);

router.put(
    '/:feed_id',
    [userAuthMiddleware.verifyAuthJWTToken],
    feedController.updateFeed
);

// Get All Feeds (pagination + filter)
router.get(
    '/',
    [userAuthMiddleware.verifyAuthJWTToken],
    feedController.getFeeds
);

router.get(
    '/getMyFeeds',
    [userAuthMiddleware.verifyAuthJWTToken],
    feedController.getMyFeeds
);

// Get Single Feed
router.get(
    '/:feed_id',
    [userAuthMiddleware.verifyAuthJWTToken],
    feedController.getFeedById
);

// Delete Feed
router.delete(
    '/:feed_id',
    [userAuthMiddleware.verifyAuthJWTToken],
    feedController.deleteFeed
);


/**
 * ===============================
 * COMMENT ROUTES
 * ===============================
 */

// Create Comment / Reply
router.post(
    '/comment',
    [userAuthMiddleware.verifyAuthJWTToken],
    feedController.createComment
);

// Get Comments of a Feed
router.get(
    '/:feed_id/comments',
    [userAuthMiddleware.verifyAuthJWTToken],
    feedController.getFeedComments
);

router.get(
    '/:feed_id/comments',
    [userAuthMiddleware.verifyAuthJWTToken],
    feedController.getFeedComments
);

/**
 * ===============================
 * LIKE ROUTES
 * ===============================
 */

// Toggle Like / Unlike
router.post(
    '/:feed_id/like',
    [userAuthMiddleware.verifyAuthJWTToken],
    feedController.toggleLikeFeed
);

router.get(
    '/directories/all',
    [userAuthMiddleware.verifyAuthJWTToken],
    feedController.getAllDirectories
);

//admin routes

router.get(
    '/admin/all',
    feedController.getAllFeeds
);

router.get(
    '/admin/:feed_id',
    feedController.getFeedByIdForAdmin
);


module.exports = router;