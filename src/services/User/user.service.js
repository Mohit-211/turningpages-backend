/** @format */

const httpStatus = require("http-status");

const {
	User,
	UserAttachment,
	Profile,
	Role,

	UserToken,
	userLoginTiming,
	Book,
	Chapter,
	ContactUs,
	UserCreditSpending,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const { bookStatus } = require("../../config/types");

const getProfile = async (body) => {
	try {
		const { user } = body;
		if (!user)
			throw new ApiError(httpStatus.BAD_REQUEST, "Failed to Get Profile.");
		return user;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const deactivateAccount = async (reqBody) => {
	try {
		const { user } = reqBody;

		const commonDestroyOptions = {
			where: { user_id: user.id },
			force: true,
		};

		await Promise.all([
			UserToken.destroy(commonDestroyOptions),
			userLoginTiming.destroy(commonDestroyOptions),
			UserAttachment.destroy(commonDestroyOptions),
		]);

		await Profile.destroy(commonDestroyOptions);
		await user.destroy({ force: true });

		return "";
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const updateProfile = async (body, files) => {
	try {
		const { name, mobile, user } = body;

		if (
			name !== undefined &&
			typeof name !== "undefined" &&
			name !== "" &&
			name !== user.user_profile.name
		) {
			user.user_profile.name = name;
		}
		if (
			mobile !== undefined &&
			typeof mobile !== "undefined" &&
			mobile !== "" &&
			mobile !== user.user_profile.mobile
		) {
			user.user_profile.mobile = mobile;
		}

		await user.user_profile.save();

		if (
			files &&
			Object.keys(files).length !== 0 &&
			files.images &&
			files.images.length !== 0
		) {
			for (let i = 0; i < files.images.length; i++) {
				let currImage = files.images[i];
				const userAttachmentObj = {
					role_id: user.role_id,
					user_id: user.id,
					title: "Profile Image",
					file_type: "Image",
					file_name: currImage.filename,
					file_uri: "/images",
					file_size: currImage.size,
				};
				await UserAttachment.create(userAttachmentObj);
			}
		}

		const userDoc = await User.findOne({
			where: { id: user.id, is_active: 1, role_id: user.role_id },
			attributes: [
				"id",
				"email",
				"role_id",
				"stripe_customer_id",
				"socket_id",
				"fcm_token",
				"status",
				"latitude",
				"longitude",
			],
			include: [
				{
					model: Profile,
					as: "user_profile",
					attributes: [
						"id",
						"name",
						"mobile",
						"overall_ratings",
						"no_of_user_rated",
						"no_of_user_reviewed",
						"is_active",
						"created_at",
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
				{
					model: Role,
					as: "user_role",
					attributes: ["id", "name", "abbreviation"],
				},
			],
		});
		if (!userDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to Update your account.",
			);
		}
		return userDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const getDashboardData = async (body) => {
	try {
		const { user } = body;
		if (!user)
			throw new ApiError(httpStatus.BAD_REQUEST, "Failed to Get Profile.");

		const response = {
			books: 0,
			words: 0,
			inediting_books: 0,
			completed_books: 0,
		};

		const booksDoc = await Book.findAll({
			where: { user_id: user.id, is_active: 1 },
			attributes: ["id", "title", "status"],
			include: [
				{
					model: Chapter,
					as: "book_chapters",
					attributes: ["id", "title", "content", "book_id", "description"],
				},
			],
		});

		if (booksDoc) {
			response["books"] = booksDoc.length;
			let wordCount = 0;
			booksDoc.map((book) => {
				if (book.status === bookStatus.in_editing) {
					response["inediting_books"] = response["inediting_books"] + 1;
				}
				if (book.status === bookStatus.completed) {
					response["completed_books"] = response["completed_books"] + 1;
				}
				let chapters = book?.book_chapters || [];
				chapters.map((chapter) => {
					if (chapter.content) {
						wordCount += chapter.content.trim().split(/\s+/).length || 0;
					}
				});
			});
			response["words"] = wordCount;
		}
		return response;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const createContact = async (body) => {
	try {
		const { name, email, subject, message, user } = body;

		if (!name || !email || !subject || !message) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"All fields (name, email, subject, message) are required.",
			);
		}

		const contactObj = {
			name,
			email,
			subject,
			message,
			created_by: user ? user.id : null,
		};

		const contactDoc = await ContactUs.create(contactObj);

		if (!contactDoc) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Failed to submit contact request.",
			);
		}

		return contactDoc;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};


const getUserCreditStats = async (body) => {
	try {
		const { user } = body;

		if (!user?.id) {
			throw new ApiError(httpStatus.BAD_REQUEST, "User id is required");
		}

		// 1️⃣ Get total credits
		const userDoc = await User.findByPk(user.id, {
			attributes: ["id", "total_credit"],
		});

		if (!userDoc) {
			throw new ApiError(httpStatus.NOT_FOUND, "User not found");
		}

		// 2️⃣ Total credits spent
		const totalSpent = await UserCreditSpending.sum("credit_spent", {
			where: { user_id: user.id },
		});

		const spentCredits = totalSpent || 0;

		// 3️⃣ Total activities (rows count)
		const totalActivities = await UserCreditSpending.count({
			where: { user_id: user.id },
		});

		// 4️⃣ Total books created
		const totalBooks = await Book.count({
			where: { user_id: user.id },
		});

		// 5️⃣ Avg credits per book
		const avgCreditsPerBook =
			totalBooks > 0 ? Math.round(spentCredits / totalBooks) : 0;

		return {
			total_credits: userDoc.total_credit,
			credits_used: spentCredits,
			avg_credits_per_book: avgCreditsPerBook,
			activities: totalActivities,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message
		);
	}
};

module.exports = {
	getProfile,
	deactivateAccount,
	updateProfile,
	getDashboardData,
	createContact,
	getUserCreditStats,
};
