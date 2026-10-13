/** @format */

const { status: httpStatus } = require("http-status");
const {
	ChatRoom,
	ChatParticipant,
	User,
	Profile,
	UserAttachment,
	Book,
	Admin,
} = require("../../models");
const { chatTypes } = require("../../models/chatRoom.model");
const { participantRoles } = require("../../models/chatParticipant.model");
const ApiError = require("../../utils/ApiError");
const sequelize = require("../../config/central.db");
const config = require("../../config/config");

const { firestore } = require("../../config/firebase");
const { Sequelize, Op } = require("sequelize");

const createAdminUserChat = async (adminId, userId) => {
	const transaction = await sequelize.transaction();
	try {
		// Check if already exists
		const existing = await ChatRoom.findOne({
			where: { type: chatTypes.ADMIN_USER },
			include: [
				{
					model: ChatParticipant,
					where: { user_id: [adminId, userId] },
				},
			],
		});

		if (existing) return existing;

		const chatRoom = await ChatRoom.create(
			{
				type: chatTypes.ADMIN_USER,
				created_by: adminId,
			},
			{ transaction },
		);

		const participants = [
			{
				chat_room_id: chatRoom.id,
				user_id: adminId,
				role: participantRoles.ADMIN,
			},
			{
				chat_room_id: chatRoom.id,
				user_id: userId,
				role: participantRoles.USER,
			},
		];

		await ChatParticipant.bulkCreate(participants, { transaction });

		await transaction.commit();
		return chatRoom;
	} catch (error) {
		await transaction.rollback();
		throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
	}
};

const sendMessage = async (chat_room_id, senderId, role, message) => {
	let roleId = String(config.USR_ROLE_ID);
	if (role === "user") {
		const userDoc = await User.findByPk(senderId);
		roleId = userDoc.role_id;
	} else if (role === "admin") {
		const userDoc = await Admin.findByPk(senderId);
		roleId = userDoc.role_id;
	}

	// Users and admins have separate id sequences, so the participant role must match the sender type
	const participant = await ChatParticipant.findOne({
		where: {
			chat_room_id: chat_room_id,
			user_id: senderId,
			role: role === "admin" ? [participantRoles.ADMIN, participantRoles.EDITOR] : participantRoles.USER,
		},
	});

	if (!participant) {
		throw new ApiError(httpStatus.FORBIDDEN, "Not allowed");
	}

	const messageRef = await firestore
		.collection("messages")
		.doc(String(chat_room_id))
		.collection("chat")
		.add({
			sender_id: String(senderId),
			sender_role: String(roleId),

			// ✅ Core
			text: message,
			type: "TEXT", // TEXT | IMAGE | FILE | SYSTEM

			// ✅ Timestamps
			created_at: new Date(),
			updated_at: null,

			// ✅ Read & Delivery
			read_by: [String(senderId)], // sender has read by default
			delivered_to: [],

			// ✅ Message State
			is_edited: false,
			is_deleted: false,

			// ✅ Reply / Thread
			reply_to: null, // messageId if reply

			// ✅ Attachments
			attachment: {
				url: null,
				type: null, // image/pdf/video
				size: null,
			},

			// ✅ Metadata (VERY IMPORTANT for future)
			meta: {
				device: "web",
				ip: null,
			},
		});

	await ChatRoom.update(
		{
			last_message: message,
			last_message_time: new Date(),
		},
		{
			where: { id: chat_room_id },
		},
	);

	return messageRef.id;
};

const createBookChat = async (bookId, userId, transaction) => {
	const admins = await Admin.findAll({
		where: { role_id: config.SUP_ADM_ROLE_ID },
		attributes: ["id"],
		transaction,
	});

	const chatRoom = await ChatRoom.create(
		{
			type: chatTypes.BOOK_GROUP,
			book_id: bookId,
			created_by: userId,
		},
		{ transaction }
	);

	const participants = [
		{
			chat_room_id: chatRoom.id,
			user_id: userId,
			role: participantRoles.USER,
		},
		...admins.map((admin) => ({
			chat_room_id: chatRoom.id,
			user_id: admin.id,
			role: participantRoles.ADMIN,
		})),
	];

	await ChatParticipant.bulkCreate(participants, { transaction });

	return chatRoom;
};

const getUserChats = async (body) => {
	try {
		const { user } = body;

		let include = [
			{
				model: Profile,
				as: "user_profile",
				attributes: [
					"id",
					"name",
					"mobile",
					"is_active",
					"created_at",
					"overall_ratings",
					"no_of_user_rated",
					"no_of_user_reviewed",
				],
			},
			{
				model: UserAttachment,
				as: "user_attachments",
				attributes: [
					"id",
					"title",
					"file_type",
					"file_name",
					"file_uri",
					"role_id",
				],
				where: { title: "Profile Image" },
				order: [["id", "desc"]],
				limit: 1,
			},
		];
		return await ChatParticipant.findAll({
			where: { user_id: user.id, role: "USER" },
			attributes: ["id", "chat_room_id", "user_id", "role"],
			include: [
				{
					model: ChatRoom,
					as: "chat_room",
					where: { is_active: true }, 
					attributes: [
						"id",
						"type",
						"book_id",
						"last_message",
						"last_message_time",
						"is_active",
					],
					include: [
						{
							model: Book,
							as: "book_details",
							attributes: ["id", "title"],
						},
						{
							model: Admin,
							as: "chat_participant_ad",
							attributes: ["name"],
						},
					],
				},
				{
					model: User,
					as: "user_details",
					attributes: ["id", "email"],
					include: include,
				},
			],
		});
	} catch (error) {
		throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
	}
};

// Only members of the chat (or a super admin) may list its participants
const getChatParticipants = async (chatId, { user, authType }) => {
	const isSuperAdmin = authType === "admin" && user.role_id === config.SUP_ADM_ROLE_ID;
	if (!isSuperAdmin) {
		const membership = await ChatParticipant.findOne({
			where: {
				chat_room_id: chatId,
				user_id: user.id,
				role: authType === "admin" ? [participantRoles.ADMIN, participantRoles.EDITOR] : participantRoles.USER,
			},
		});
		if (!membership) {
			throw new ApiError(httpStatus.FORBIDDEN, "Not allowed");
		}
	}

	return await ChatParticipant.findAll({
		where: { chat_room_id: chatId },

		attributes: ["user_id", "role"],

		include: [
			// 👤 USER (only when role = USER)
			{
				model: User,
				as: "user_details",
				attributes: ["id"],
				required: false,
				where: {
					"$ChatParticipant.role$": "USER",
				},
				include: [
					{
						model: Profile,
						as: "user_profile",
						attributes: ["name"],
					},
				],
			},

			// 🧑‍💼 ADMIN / EDITOR (only when NOT USER)
			{
				model: Admin,
				as: "admin_details",
				attributes: ["id", "name"],
				required: false,
				where: {
					"$ChatParticipant.role$": ["ADMIN", "EDITOR"],
				},
			},
		],
	});
};

// admin apis
const getAllAdminChats = async (body) => {
	try {
		const { user } = body;

		return await ChatParticipant.findAll({
			where: {
				user_id: user.id,
				role: {
					[Op.in]: ["ADMIN", "EDITOR"],
				},
			},

			attributes: ["id", "chat_room_id", "user_id", "role"],

			include: [
				{
					model: ChatRoom,
					as: "chat_room",
					attributes: [
						"id",
						"type",
						"book_id",
						"last_message",
						"last_message_time",
						"is_active",
					],
					include: [
						{
							model: Book,
							as: "book_details",
							attributes: ["id", "title"],
						},

						{
							model: ChatParticipant,
							as: "participants",
							attributes: ["user_id", "role"],

							include: [
								// 👤 USER ONLY
								{
									model: User,
									as: "user_details",
									attributes: ["id", "email"],
									required: false,
									where: {
										"$chat_room.participants.role$": "USER",
									},
									include: [
										{
											model: Profile,
											as: "user_profile",
											attributes: ["name"],
										},
									],
								},

								// 🧑‍💼 ADMIN / EDITOR ONLY
								{
									model: Admin,
									as: "admin_details",
									attributes: ["id", "name"],
									required: false,
									where: {
										"$chat_room.participants.role$": ["ADMIN", "EDITOR"],
									},
								},
							],
						},

					],
				},
			],

			order: [
				[
					Sequelize.literal(
						"COALESCE(chat_room.last_message_time, chat_room.created_at)",
					),
					"DESC",
				],
			],
		});
	} catch (error) {
		throw new ApiError(httpStatus.INTERNAL_SERVER_ERROR, error.message);
	}
};

module.exports = {
	createAdminUserChat,
	createBookChat,
	getUserChats,
	getChatParticipants,
	sendMessage,

	getAllAdminChats,
};
