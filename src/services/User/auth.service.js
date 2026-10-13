/** @format */

const { status: httpStatus } = require("http-status");
const bcrypt = require("bcryptjs");
const { DateTime } = require("luxon");
const { OTP, User, Profile, userLoginTiming, Timezone } = require("../../models");
const sequelize = require("../../config/central.db");
const validateEmail = require("../../helpers/validateEmail");
const validatePassword = require("../../helpers/validatePassword");
const ApiError = require("../../utils/ApiError");
const generateOtp = require("../../utils/generateOtp");
const { hashSecret, matchesHash, generateResetToken } = require("../../utils/secretHash");
const {
	sendForgotPasswordOTP,
	sendEmailVerification,
	sendOTPMails,
} = require("../Common/email.service");
const { generateAuthTokens, revokeAllUserTokens } = require("../Common/token.service");
const { otpTypes, userStatusTypes } = require("../../config/types");
const config = require("../../config/config");
const logger = require("../../config/logger");

const OTP_TYPES_ALLOWED = [otpTypes.EMAIL_VERIFICATION, otpTypes.FORGOT_PASSWORD];
const PASSWORD_RULES_MESSAGE =
	"Password should have a minimum length of 8 characters and must have at least 2 digits and No Blank Space";

// Compared against when the email is unknown, so response time does not reveal which emails exist
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(generateResetToken(), 10);

const profileAttributes = [
	"id",
	"name",
	"mobile",
	"overall_ratings",
	"no_of_user_rated",
	"no_of_user_reviewed",
	"is_active",
	"created_at",
];

const findActiveUser = (email) =>
	User.findOne({
		where: { email, role_id: config.USR_ROLE_ID, is_active: true },
		include: [{ model: Profile, as: "user_profile", attributes: profileAttributes }],
	});

// Creates a fresh OTP for the user (replacing older ones of the same type) and returns the plain code.
// When the resend cooldown has not passed: throws 429, or returns null if `silentCooldown` is set.
const issueOtp = async (user, type, { silentCooldown = false, transaction } = {}) => {
	const latest = await OTP.findOne({
		where: { user_id: user.id, role_id: user.role_id, type },
		order: [["created_at", "DESC"]],
		transaction,
	});
	if (latest) {
		const waitMs = latest.created_at.getTime() + config.otp.resendCooldownSeconds * 1000 - Date.now();
		if (waitMs > 0) {
			if (silentCooldown) return null;
			throw new ApiError(
				httpStatus.TOO_MANY_REQUESTS,
				`Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting a new OTP.`,
			);
		}
	}

	await OTP.destroy({ where: { user_id: user.id, role_id: user.role_id, type }, force: true, transaction });
	const code = generateOtp(config.otp.length);
	await OTP.create(
		{ user_id: user.id, email: user.email, role_id: user.role_id, type, code: hashSecret(code) },
		{ transaction },
	);
	return code;
};

const sendOTP = async (body) => {
	const { email, type } = body;

	if (!validateEmail(email) || !OTP_TYPES_ALLOWED.includes(type)) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Email or Type.");
	}

	const userDoc = await findActiveUser(email);
	// Same response whether or not the account exists
	if (!userDoc) return true;
	if (type === otpTypes.EMAIL_VERIFICATION && userDoc.status !== userStatusTypes.PENDING) return true;

	const code = await issueOtp(userDoc, type);
	if (type === otpTypes.FORGOT_PASSWORD) {
		await sendForgotPasswordOTP(email, code);
	} else {
		await sendEmailVerification(email, code);
	}
	return true;
};

const verifyOTP = async (email, otp, type) => {
	if (!email || !otp || !type) {
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"Please Enter Required Fields : [email, otp, type]",
		);
	}
	if (!OTP_TYPES_ALLOWED.includes(type)) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Email or Type");
	}

	const userDoc = await findActiveUser(email);
	const otpDoc =
		userDoc &&
		(await OTP.findOne({
			where: { user_id: userDoc.id, role_id: userDoc.role_id, type, is_active: true, is_verified: false },
			order: [["created_at", "DESC"]],
		}));

	if (!otpDoc) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP. Please request a new one.");
	}

	if (otpDoc.otp_expiration_time < new Date() || otpDoc.attempts >= config.otp.maxAttempts) {
		await otpDoc.destroy({ force: true });
		throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP. Please request a new one.");
	}

	if (!matchesHash(String(otp).trim(), otpDoc.code)) {
		const attempts = otpDoc.attempts + 1;
		if (attempts >= config.otp.maxAttempts) {
			await otpDoc.destroy({ force: true });
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Too many incorrect attempts. Please request a new OTP.",
			);
		}
		await otpDoc.update({ attempts });
		throw new ApiError(httpStatus.BAD_REQUEST, "Invalid OTP Entered");
	}

	if (type === otpTypes.FORGOT_PASSWORD) {
		const token = generateResetToken();
		await otpDoc.update({
			code: hashSecret(token),
			is_verified: true,
			is_active: false,
			otp_expiration_time: new Date(Date.now() + config.otp.resetTokenExpirationMinutes * 60 * 1000),
		});
		return { token };
	}

	await User.update({ status: userStatusTypes.ACCEPTED }, { where: { id: userDoc.id } });
	await otpDoc.destroy({ force: true });

	// Welcome email to the user plus a signup notification to the team; delivery failures are only logged
	sendOTPMails(email).catch((err) => {
		logger.error(`Welcome email failed: ${err.message}`);
	});

	return { verified: true };
};

const register = async (body) => {
	const { name, last_name, email, mobile, password } = body;

	const existing = await findActiveUser(email);
	if (existing) {
		if (existing.status === userStatusTypes.PENDING) {
			const code = await issueOtp(existing, otpTypes.EMAIL_VERIFICATION, { silentCooldown: true });
			if (code) await sendEmailVerification(email, code);
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"User is not verified yet.Please verify Your Otp First",
			);
		}
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"Email already taken please use another email or login with your existing email",
		);
	}

	const code = await sequelize.transaction(async (transaction) => {
		const user = await User.create(
			{
				email,
				password: await bcrypt.hash(password, 10),
				role_id: config.USR_ROLE_ID,
			},
			{ transaction },
		);

		const profileObj = { user_id: user.id, email, name, last_name };
		// Phone number is optional at signup
		if (mobile && mobile !== "undefined") profileObj.mobile = mobile;
		await Profile.create(profileObj, { transaction });

		return issueOtp(user, otpTypes.EMAIL_VERIFICATION, { transaction });
	});

	await sendEmailVerification(email, code);
	return {};
};

const login = async (reqBody, headers) => {
	const { email, password } = reqBody;
	const user = await findActiveUser(email);

	const validPass = await bcrypt.compare(
		String(password),
		user && user.password ? user.password : DUMMY_PASSWORD_HASH,
	);
	if (!user || !user.password || !validPass) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Invalid email or password. Please try again.");
	}

	if (user.status === userStatusTypes.PENDING) {
		const code = await issueOtp(user, otpTypes.EMAIL_VERIFICATION, { silentCooldown: true });
		if (code) await sendEmailVerification(user.email, code);
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"User is not verified yet.Please verify Your Otp First",
		);
	}
	if (user.status === userStatusTypes.REJECTED) {
		throw new ApiError(httpStatus.BAD_REQUEST, "User rejected.");
	}

	const token = await generateAuthTokens(user);
	await saveLoginTiming(user, token, reqBody.ip_address, headers.timezone);

	delete token.access.id;
	delete token.refresh.id;
	return {
		id: user.id,
		name: user.user_profile?.name,
		email: user.email,
		tokens: token,
		role_id: user.role_id,
	};
};

const resetPassword = async (reqBody) => {
	const { old_password, confirm_password, user } = reqBody;

	const userDoc = await User.findByPk(user.id);
	const validPass = userDoc?.password && (await bcrypt.compare(String(old_password), userDoc.password));
	if (!validPass) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect Old Password.");
	}

	userDoc.password = await bcrypt.hash(confirm_password, 10);
	await userDoc.save();

	// Sign out every session, then give this client a fresh token
	await revokeAllUserTokens(userDoc.id);
	const token = await generateAuthTokens(userDoc);
	return { tokens: token };
};

const forgotPassword = async (reqBody) => {
	const { email, token, password, confirm_password } = reqBody;

	if (!email || !token || !password || !confirm_password) {
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"Please Enter Required Fields : [ email || password || confirm_password || token ]",
		);
	}
	if (!validatePassword(password)) {
		throw new ApiError(httpStatus.BAD_REQUEST, PASSWORD_RULES_MESSAGE);
	}
	if (password !== confirm_password) {
		throw new ApiError(httpStatus.BAD_REQUEST, "New Password and Confirm Password Must Be Equal");
	}

	const userDoc = await findActiveUser(email);
	const otpDoc =
		userDoc &&
		(await OTP.findOne({
			where: { user_id: userDoc.id, role_id: userDoc.role_id, type: otpTypes.FORGOT_PASSWORD, is_verified: true },
			order: [["created_at", "DESC"]],
		}));

	if (!otpDoc || otpDoc.otp_expiration_time < new Date() || !matchesHash(String(token), otpDoc.code)) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Forget Password Token is not Valid.");
	}

	userDoc.password = await bcrypt.hash(password, 10);
	await userDoc.save();
	await otpDoc.destroy({ force: true });
	await revokeAllUserTokens(userDoc.id);
	return "";
};

const logout = async (reqBody, headers) => {
	const { tokenDoc } = reqBody;
	await saveLogoutTiming(tokenDoc);
	await tokenDoc.destroy();
	return "";
};

// Login history is best-effort: a missing or unknown timezone header must not block login
const saveLoginTiming = async (user, token, ipAddress, timezone) => {
	try {
		const zone =
			timezone && DateTime.utc().setZone(timezone).isValid ? timezone : config.DEFAULT_TIMEZONE;
		const timeZoneDoc =
			(await Timezone.findOne({ where: { time_zone: zone, is_active: true } })) ||
			(await Timezone.findOne({ where: { time_zone: config.DEFAULT_TIMEZONE, is_active: true } }));
		if (!timeZoneDoc) {
			logger.warn(`Login timing not saved: timezone "${zone}" is not in the timezones table`);
			return null;
		}

		const loginTimeUTC = DateTime.utc();
		return await userLoginTiming.create({
			user_id: user.id,
			role_id: user.role_id,
			login_time_utc: loginTimeUTC.toJSDate(),
			login_time_local: loginTimeUTC.setZone(timeZoneDoc.time_zone).toFormat("yyyy-MM-dd hh:mm:ss"),
			ip_address: ipAddress,
			token_id: token.access.id,
			time_zone: timeZoneDoc.id,
		});
	} catch (error) {
		logger.warn(`Login timing not saved: ${error.message}`);
		return null;
	}
};

const saveLogoutTiming = async (tokenDoc) => {
	try {
		const logoutTime = new Date();
		const loginTimingDoc = await userLoginTiming.findOne({ where: { token_id: tokenDoc.id } });
		if (loginTimingDoc) {
			loginTimingDoc.logout_time_utc = logoutTime;
			// Same instant as before: Sequelize always stored the zoned moment value in UTC
			loginTimingDoc.logout_time_local = logoutTime;
			await loginTimingDoc.save();
		}
	} catch (error) {
		logger.warn(`Logout timing not saved: ${error.message}`);
	}
};

module.exports = {
	register,
	login,
	resetPassword,
	sendOTP,
	verifyOTP,
	forgotPassword,
	logout,
};
