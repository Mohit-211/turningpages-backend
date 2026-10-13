const express = require('express');
const router = express.Router();

const { quoteController } = require('../../../controllers');
const { adminAuthMiddleware } = require('../../../middlewares');

/**
 * ===============================
 * QUOTE ROUTES
 * ===============================
 */

// Create Quote
router.post(
    '/',
    [adminAuthMiddleware.validateJWTtoken],
    quoteController.createQuote
);

// Update Quote
router.put(
    '/:quote_id',
    [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin],
    quoteController.updateQuote
);

// Delete Quote (Soft delete)
router.delete(
    '/:quote_id',
    [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin],
    quoteController.deleteQuote
);

// Get All Quotes (Public – pagination + filter)
router.get(
    '/',
    quoteController.getQuotes
);

// Get Single Quote
router.get(
    '/:quote_id',
    quoteController.getQuoteById
);

// Get Quotes By Tag Slug
router.get(
    '/tag/:slug',
    quoteController.getQuotesByTag
);


router.get('/tags/list', quoteController.getAllTags);

// Create Tag
router.post(
    '/tags',
    [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin],
    quoteController.createTag
);


// Update tag
router.put(
    '/tags/:id',
    [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin],
    quoteController.updateTag
);

// Delete Tag 
router.delete(
    '/tags/:id',
    [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin],
    quoteController.deleteTag
);


module.exports = router;