const express = require('express');
const router = express.Router();

const { supportController } = require('../../../controllers');
const { userAuthMiddleware, adminAuthMiddleware } = require('../../../middlewares');

// Create ticket
router.post(
    '/',
    [userAuthMiddleware.verifyAuthJWTToken],
    supportController.createTicket
);

// Update ticket (subject/description)
router.put(
    '/',
    [userAuthMiddleware.verifyAuthJWTToken],
    supportController.updateTicket
);

// Get logged-in user's tickets
router.get(
    '/',
    [userAuthMiddleware.verifyAuthJWTToken],
    supportController.getMyTickets
);

// Get ticket by ID
router.get(
    '/:ticketId',
    [userAuthMiddleware.verifyAuthJWTToken],
    supportController.getTicketById
);

// Reply to ticket
router.post(
    '/:ticketId/message',
    [userAuthMiddleware.verifyAuthJWTToken],
    supportController.addMessage
);

// Search tickets
router.post(
    '/search',
    [userAuthMiddleware.verifyAuthJWTToken],
    supportController.searchTickets
);

// Delete ticket (soft delete)
router.delete(
    '/remove',
    [userAuthMiddleware.verifyAuthJWTToken],
    supportController.removeTicket
);



/* ================= ADMIN / SUPPORT APIs ================= */

// Get all tickets
router.get(
    '/ad/all',
    [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin],
    supportController.getAllTickets
);

// Assign ticket
router.post(
    '/ad/assign',
    [adminAuthMiddleware.validateJWTtoken],
    supportController.assignTicket
);

// Update ticket status
router.post(
    '/ad/status/update',
    [adminAuthMiddleware.validateJWTtoken],
    supportController.updateStatus
);

// Update ticket priority
router.post(
    '/ad/priority/update',
    [adminAuthMiddleware.validateJWTtoken],
    supportController.updatePriority
);

// Add internal note
router.post(
    '/ad/internal-note',
    [adminAuthMiddleware.validateJWTtoken],
    supportController.addInternalNote
);

// Close ticket
router.post(
    '/ad/close',
    [adminAuthMiddleware.validateJWTtoken],
    supportController.closeTicket
);

// Reopen ticket
router.post(
    '/ad/reopen',
    [adminAuthMiddleware.validateJWTtoken],
    supportController.reopenTicket
);

// update ticket by admin
router.post(
    '/ad/admin',
    [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin],
    supportController.updateTicketByAdmin
);



module.exports = router;
