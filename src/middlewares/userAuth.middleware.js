/** @format */

const { status: httpStatus } = require("http-status");
const jwt = require("jsonwebtoken");

const {
	User,
	UserToken,
	Profile,
	UserAttachment,
	UserSubscription,
	Payment,
} = require("../models");
const validateEmail = require("../helpers/validateEmail");
const validatePassword = require("../helpers/validatePassword");
const { tokenTypes } = require("../config/types");
const catchAsync = require("../utils/catchAsync");
const ApiError = require("../utils/ApiError");

const config = require("../config/config");
const responseWrapper = require("../config/responseWrapper");

const validateRegisterUserBody = catchAsync(async (req, res, next) => {
	const { name, email, password, confirm_password } = req.body;

	if (!name || !email || !password || !confirm_password) {
		return responseWrapper(
			res,
			"",
			"Please Enter Required Fields : [ name || email || password || confirm_password]",
			httpStatus.BAD_REQUEST,
		);
	}

	if (!validateEmail(email) || String(name).trim().length === 0) {
		return responseWrapper(
			res,
			"",
			"Invalid Name or Email",
			httpStatus.BAD_REQUEST,
		);
	}

	if (!validatePassword(password)) {
		return responseWrapper(
			res,
			"",
			"Password should have a minimum length of 8 characters and must have at least 2 digits and No Blank Space",
			httpStatus.BAD_REQUEST,
		);
	}

	if (password !== confirm_password) {
		return responseWrapper(
			res,
			"",
			"Password and Confirm Password must be equal.",
			httpStatus.BAD_REQUEST,
		);
	}
	next();
});

// Verifies the Google reCAPTCHA token sent as `captcha`. Works for v2 (checkbox) and v3 tokens;
// v3 responses carry a score, which must meet RECAPTCHA_MIN_SCORE.
const verifyCaptcha = catchAsync(async (req, res, next) => {
	const { captcha } = req.body;
	if (!captcha) {
		return responseWrapper(res, "", "Please complete the captcha.", httpStatus.BAD_REQUEST);
	}

	let result;
	try {
		const response = await fetch("https://www.google.com/recaptcha/api/siteverify", {
			method: "POST",
			headers: { "content-type": "application/x-www-form-urlencoded" },
			body: new URLSearchParams({
				secret: config.recaptcha.secretKey,
				response: String(captcha),
				remoteip: req.ip,
			}),
			signal: AbortSignal.timeout(10000),
		});
		result = await response.json();
	} catch (error) {
		throw new ApiError(httpStatus.SERVICE_UNAVAILABLE, "Could not verify the captcha. Please try again.");
	}

	const scoreOk = typeof result.score !== "number" || result.score >= config.recaptcha.minScore;
	if (!result.success || !scoreOk) {
		return responseWrapper(res, "", "Captcha verification failed. Please try again.", httpStatus.BAD_REQUEST);
	}
	next();
});

const validateSignInReqBody = catchAsync(async (req, res, next) => {
	const { email, password } = req.body;

	if (!email || !password) {
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"Please Enter Required Fields : [email, password] ",
		);
	}
	req.body.ip_address = req.ip;

	next();
});

// Verifies a user access token and attaches the user to req.body. Throws ApiError(401) when invalid.
const authenticateUser = async (req, token) => {
	let payload;
	try {
		payload = jwt.verify(token, config.jwt.secret, { algorithms: ["HS256"] });
	} catch (error) {
		throw new ApiError(
			httpStatus.UNAUTHORIZED,
			error.name === "TokenExpiredError" ? "Session expired. Please log in again." : "Invalid Token",
		);
	}
	if (payload.type !== tokenTypes.ACCESS) {
		throw new ApiError(httpStatus.UNAUTHORIZED, "Invalid Token");
	}

	const tokenDoc = await UserToken.findOne({
		where: {
			token: token,
			token_type: tokenTypes.ACCESS,
			user_id: payload.sub,
			is_active: true,
		},
	});
	if (!tokenDoc) {
		throw new ApiError(httpStatus.UNAUTHORIZED, "Session expired. Please log in again.");
	}

	const user = await User.findOne({
		where: { id: tokenDoc.user_id, is_active: 1, role_id: tokenDoc.role_id },
		attributes: [
			"id",
			"email",
			"role_id",
			"status",
			"is_active",
			"stripe_customer_id",
			"total_credit",
		],
		include: [
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
		],
	});
	if (!user) {
		throw new ApiError(httpStatus.UNAUTHORIZED, "User Not Found");
	}

	// 🔥 Check if user has active subscription
	const activeSubscription = await UserSubscription.findOne({
		where: {
			user_id: user.id,
			status: "active",
		},
	});

	// 🔥 Check if user has purchased publishing package
	const latestPayment = await Payment.findOne({
		where: {
			user_id: user.id,
			payment_for: "package_purchase", // ✅ important filter
			payment_status: "success", // ✅ only successful
		},
		order: [["created_at", "DESC"]], // ✅ latest package
	});

	// ✅ attach flags
	user.dataValues.publishing_package = !!latestPayment;
	user.dataValues.publishing_package_name = latestPayment?.package_name || null;
	user.dataValues.has_active_plan = !!activeSubscription;
	user.dataValues.package_name = activeSubscription?.package_name || null;

	req.body.user = user;
	req.body.tokenDoc = tokenDoc;
	req.body.ip_address = req.ip;
	req.body.authType = "user";
};

const verifyAuthJWTToken = catchAsync(async (req, res, next) => {
	const token = req.headers["x-access-token"];
	if (!token) {
		return responseWrapper(res, "", "Please authenticate", httpStatus.UNAUTHORIZED);
	}
	await authenticateUser(req, token);
	next();
});

const validateResetPassordBody = catchAsync(async (req, res, next) => {
	const { old_password, new_password, confirm_password } = req.body;

	if (!old_password || !new_password || !confirm_password) {
		return responseWrapper(
			res,
			"",
			"Please Enter Required Fields : [ old_password || new_password || confirm_password ]",
			httpStatus.BAD_REQUEST,
		);
	}

	if (new_password !== confirm_password) {
		return responseWrapper(
			res,
			"",
			"New Password and Confirm Password Must Be Equal",
			httpStatus.BAD_REQUEST,
		);
	}
	next();
});

module.exports = {
	validateRegisterUserBody,
	verifyCaptcha,
	authenticateUser,
	verifyAuthJWTToken,
	validateResetPassordBody,
	validateSignInReqBody,
};
