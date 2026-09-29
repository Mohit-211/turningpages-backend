/** @format */

const httpStatus = require("http-status");
const { Op, Sequelize } = require("sequelize");
const {
	Feed,
	User,
	Genre,
	UserFeedComment,
	UserFeedLike,
	Profile,
	UserAttachment,
	Book,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const sequelize = require("../../config/central.db");

/**
 * ===============================
 * CREATE FEED
 * ===============================
 */
const createFeed = async (body, files) => {
	try {
		const { user, title, content, genre_id, visibility, tags } = body;

		if (!title || !genre_id || !content) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"title, content and genre_id are required",
			);
		}
		let img_name = null;
		let img_uri = null;

		const genre = await Genre.findByPk(genre_id);
		if (!genre) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid genre_id");
		}
		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			const currImage = files.images[0];
			img_name = currImage.filename;
			img_uri = currImage.filename;
		}

		const feed = await Feed.create({
			user_id: user.id,
			title,
			content,
			genre_id,
			visibility: visibility || "public",
			tags,
			img_name,
			img_uri,
		});

		return feed;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const updateFeed = async (feed_id, body, files) => {
	try {
		const { user, title, content, genre_id, visibility, tags } = body;

		if (!feed_id) {
			throw new ApiError(httpStatus.BAD_REQUEST, "feed_id is required");
		}

		const feed = await Feed.findByPk(feed_id);

		if (!feed) {
			throw new ApiError(httpStatus.NOT_FOUND, "Feed not found");
		}
		let img_name = null;
		let img_uri = null;
		// Ownership check
		if (feed.user_id !== user.id) {
			throw new ApiError(
				httpStatus.FORBIDDEN,
				"You are not authorized to update this feed",
			);
		}

		// If genre_id is being updated, validate it
		if (genre_id) {
			const genre = await Genre.findByPk(genre_id);
			if (!genre) {
				throw new ApiError(httpStatus.BAD_REQUEST, "Invalid genre_id");
			}
		}
		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			const currImage = files.images[0];
			img_name = currImage.filename;
			img_uri = currImage.filename;
		}
		await feed.update({
			title: title ?? feed.title,
			content: content ?? feed.content,
			genre_id: genre_id ?? feed.genre_id,
			visibility: visibility ?? feed.visibility,
			tags: tags ?? feed.tags,
			img_uri: img_uri ?? feed.img_uri,
			img_name: img_name ?? feed.img_name,
		});

		return feed;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

/**
 * ===============================
 * GET ALL FEEDS (Pagination + Filter)
 * ===============================
 */
const getFeeds = async (body, query) => {
	try {
		const { user } = body;
		const { page = 1, limit = 10, genre_id, user_id } = query;

		const offset = (page - 1) * limit;

		let whereCondition = {
			is_active: true,
			visibility: "public",
		};

		if (genre_id) whereCondition.genre_id = genre_id;
		if (user_id) whereCondition.user_id = user_id;

		const feeds = await Feed.findAndCountAll({
			where: whereCondition,
			include: [
				{
					model: UserFeedComment,
					as: "replies",
					required: false,
				},
				{
					model: UserFeedLike,
					as: "feed_likes",
					attributes: ["id"],
					where: { user_id: user.id },
					required: false,
				},
				{
					model: User,
					as: "feed_user",
					attributes: ["id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name", "mobile", "is_active", "created_at"],
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
							order: [["id", "desc"]],
							limit: 1,
							where: { title: "Profile Image" },
						},
					],
				},
			],
			order: [["created_at", "DESC"]],
			limit: Number(limit),
			offset: Number(offset),
		});

		return feeds;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

/**
 * ===============================
 * GET SINGLE FEED
 * ===============================
 */
const getFeedById = async (body, feed_id) => {
	try {
		const { user } = body;

		const feed = await Feed.findOne({
			where: {
				id: feed_id,
				is_active: true,
			},
			include: [
				{
					model: UserFeedComment,
					as: "replies",
					required: false,
				},
				{
					model: UserFeedLike,
					as: "feed_likes",
					attributes: ["id"],
					where: { user_id: user.id },
					required: false,
				},
				{
					model: User,
					as: "feed_user",
					attributes: ["id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name", "mobile", "is_active", "created_at"],
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
							limit: 1,
							where: { title: "Profile Image" },
							required: false,
						},
					],
				},
			],
		});

		if (!feed) {
			throw new ApiError(httpStatus.NOT_FOUND, "Feed not found");
		}

		// increment view count
		await feed.increment("views_count");

		const feedJson = feed.toJSON();

		feedJson.isLiked = feedJson.feed_likes.length > 0;

		delete feedJson.feed_likes;

		return feedJson;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const getMyFeeds = async (body, query) => {
	try {
		const { user } = body;
		const { page = 1, limit = 10, genre_id } = query;

		const offset = (page - 1) * limit;

		let whereCondition = {
			is_active: true,
			visibility: "public",
			user_id: user.id,
		};

		if (genre_id) whereCondition.genre_id = genre_id;

		const feeds = await Feed.findAndCountAll({
			where: whereCondition,
			include: [
				{
					model: UserFeedComment,
					as: "replies",
					required: false,
				},
				{
					model: UserFeedLike,
					as: "feed_likes",
					attributes: ["id"],
					// where: { user_id: user.id },
					required: false,
					include: [
						{
							model: User,
							as: "liked_user",
							attributes: ["id"],
							include: [
								{
									model: Profile,
									as: "user_profile",
									attributes: ["id", "name", "mobile"],
								},
							],
						},
					],
				},
				{
					model: User,
					as: "feed_user",
					attributes: ["id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name", "mobile", "is_active", "created_at"],
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
							order: [["id", "desc"]],
							limit: 1,
							where: { title: "Profile Image" },
						},
					],
				},
			],
			order: [["created_at", "DESC"]],
			limit: Number(limit),
			offset: Number(offset),
		});

		return feeds;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

/**
 * ===============================
 * DELETE FEED (Soft Delete)
 * ===============================
 */
const deleteFeed = async (body, feed_id) => {
	try {
		const { user } = body;
		const feed = await Feed.findByPk(feed_id);

		if (!feed) {
			throw new ApiError(httpStatus.NOT_FOUND, "Feed not found");
		}

		if (feed.user_id !== user.id) {
			throw new ApiError(httpStatus.FORBIDDEN, "Unauthorized");
		}

		await feed.destroy();
		return true;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

/**
 * ===============================
 * CREATE COMMENT / REPLY
 * ===============================
 */
const createComment = async ({ user, feed_id, content, parent_id }) => {
	try {
		if (!content) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Content is required");
		}

		const feed = await Feed.findByPk(feed_id);
		if (!feed) {
			throw new ApiError(httpStatus.NOT_FOUND, "Feed not found");
		}

		if (parent_id) {
			const parentComment = await UserFeedComment.findByPk(parent_id);
			if (!parentComment) {
				throw new ApiError(httpStatus.BAD_REQUEST, "Invalid parent comment");
			}
		}

		const comment = await sequelize.transaction(async (t) => {
			const newComment = await UserFeedComment.create(
				{
					user_id: user.id,
					feed_id,
					parent_id: parent_id || null,
					content,
				},
				{ transaction: t },
			);

			await feed.increment("comment_count", { transaction: t });

			return newComment;
		});

		return comment;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

/**
 * ===============================
 * GET COMMENTS (with replies)
 * ===============================
 */
const getFeedComments = async (feed_id) => {
	try {
		const comments = await UserFeedComment.findAll({
			where: {
				feed_id,
				parent_id: null,
				is_active: true,
			},
			order: [["created_at", "DESC"]],
			include: [
				{
					model: UserFeedComment,
					as: "replies",
					required: false,
				},
				{
					model: User,
					as: "feed_comment_user",
					attributes: ["id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name", "mobile", "is_active", "created_at"],
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
							limit: 1,
							where: { title: "Profile Image" },
							required: false,
						},
					],
				},
			],
		});

		return comments;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

/**
 * ===============================
 * LIKE / UNLIKE FEED (Transaction Safe)
 * ===============================
 */
const toggleLikeFeed = async (body, feed_id) => {
	try {
		const { user } = body;

		const feed = await Feed.findByPk(feed_id);
		if (!feed) {
			throw new ApiError(httpStatus.NOT_FOUND, "Feed not found");
		}

		return await sequelize.transaction(async (t) => {
			const existingLike = await UserFeedLike.findOne({
				where: {
					user_id: user.id,
					feed_id,
				},
				transaction: t,
			});

			if (existingLike) {
				await existingLike.destroy({
					force: true,
					transaction: t,
				});
				await feed.decrement("likes_count", { transaction: t });
				return { liked: false };
			} else {
				await UserFeedLike.create(
					{
						user_id: user.id,
						feed_id,
					},
					{ transaction: t },
				);

				await feed.increment("likes_count", { transaction: t });
				return { liked: true };
			}
		});
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const getAllFeeds = async (query) => {
	try {
		console.log("QUERY RECEIVED:", query);
		const page = Number(query.page) || 1;
		const limit = Number(query.limit) || 10;
		const offset = (page - 1) * limit;

		const { genre_id, search } = query;

		// ✅ BASE WHERE
		let whereCondition = {
			is_active: true,
			visibility: "public",
		};

		if (genre_id) whereCondition.genre_id = genre_id;

		// ✅ SEARCH
		if (search) {
			whereCondition[Op.or] = [
				{ title: { [Op.like]: `%${search}%` } },
				{ description: { [Op.like]: `%${search}%` } },
			];
		}

		const { count, rows } = await Feed.findAndCountAll({
			where: whereCondition,

			include: [
				{
					model: User,
					as: "feed_user",
					attributes: ["id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name", "mobile"],
						},
						{
							model: UserAttachment,
							as: "user_attachments",
							attributes: ["id", "file_uri", "file_type"],
							where: { title: "Profile Image" },
							required: false,
							separate: true,
							limit: 1,
							order: [["id", "DESC"]],
						},
					],
				},
			],

			order: [["created_at", "DESC"]],
			limit,
			offset,
			distinct: true,
		});

		return {
			total: count,
			page,
			limit,
			data: rows,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const getFeedByIdForAdmin = async (feed_id) => {
	try {
		const feed = await Feed.findOne({
			where: {
				id: feed_id,
				is_active: true,
			},

			include: [
				{
					model: UserFeedComment,
					as: "replies",
					required: false,
					order: [["created_at", "DESC"]],
					include: [
						{
							model: User,
							as: "feed_comment_user",
							attributes: ["id"],
							include: [
								{
									model: Profile,
									as: "user_profile",
									attributes: ["id", "name", "mobile"],
								},
							],
						},
					],
				},
				{
					model: UserFeedLike,
					as: "feed_likes",
					attributes: ["id"],
					required: false,
					include: [
						{
							model: User,
							as: "liked_user",
							attributes: ["id"],
							include: [
								{
									model: Profile,
									as: "user_profile",
									attributes: ["id", "name", "mobile"],
								},
							],
						},
					],
				},
				{
					model: Genre,
					as: "feed_genre",
					attributes: ["id", "title"],
				},

				{
					model: User,
					as: "feed_user",
					attributes: ["id"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["id", "name", "mobile"],
						},
						{
							model: UserAttachment,
							as: "user_attachments",
							attributes: ["id", "file_uri", "file_type"],
							where: { title: "Profile Image" },
							required: false,
							separate: true,
							limit: 1,
							order: [["id", "DESC"]],
						},
					],
				},
			],

			order: [["created_at", "DESC"]],
		});

		if (!feed) {
			throw new ApiError(httpStatus.NOT_FOUND, "Feed not found");
		}

		// ✅ increment views
		await feed.increment("views_count");

		return feed;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const getAllDirectories = async (body) => {
	try {
		const { user } = body;
		const directoryDocs = await Book.findAll({
			where: { user_id: user.id },
			group: ["genre_id"],
			attributes: ["genre_id"],
			include: [
				{
					model: Genre,
					as: "book_genre",
					attributes: ["id", "title"],
				},
			],
		});

		return directoryDocs;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

module.exports = {
	createFeed,
	updateFeed,
	getFeeds,
	getMyFeeds,
	getFeedById,
	deleteFeed,
	createComment,
	getFeedComments,
	toggleLikeFeed,
	getAllFeeds,
	getFeedByIdForAdmin,
	getAllDirectories,
};
