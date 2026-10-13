/** @format */

const express = require("express");
const router = express.Router();

const { chatController } = require("../../../controllers");
const {
	adminAuthMiddleware,
	userAuthMiddleware,
	anyAuthMiddleware,
} = require("../../../middlewares");

// Admin creates chat
router.post(
	"/admin-user",
	adminAuthMiddleware.validateJWTtoken,
	chatController.createAdminUserChat,
);

// Book chat
router.post(
	"/book",
	adminAuthMiddleware.validateJWTtoken,
	chatController.createBookChat,
);

// Get my chats
router.get(
	"/my",
	userAuthMiddleware.verifyAuthJWTToken,
	chatController.getMyChats,
);

// Get participants
router.get(
	"/:id/participants",
	anyAuthMiddleware.verifyUserOrAdmin,
	chatController.getParticipants,
);

router.post(
	"/message/send",
	userAuthMiddleware.verifyAuthJWTToken,
	chatController.sendMessage,
);

router.post(
	"/message/send/admin",
	adminAuthMiddleware.validateJWTtoken,
	chatController.sendMessageAdmin,
);

// admin apis

router.get(
	"/getAllAdminChats",
	[adminAuthMiddleware.validateJWTtoken],
	chatController.getAllAdminChats,
);


module.exports = router;
