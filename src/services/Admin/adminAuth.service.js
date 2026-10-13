/** @format */

const { status: httpStatus } = require("http-status");
const bcrypt = require("bcryptjs");
const crypto = require("crypto");
const jwt = require("jsonwebtoken");

const { Admin, Department, Role } = require("../../models");
const sequelize = require("../../config/central.db");
const ApiError = require("../../utils/ApiError");
const config = require("../../config/config");
const { tokenTypes } = require("../../config/types");
const generateOtp = require("../../utils/generateOtp");
const validatePassword = require("../../helpers/validatePassword");
const { hashSecret, matchesHash, generateResetToken } = require("../../utils/secretHash");
const { sendForgotPasswordOTP, sendAdminCredentials } = require("../Common/email.service");

// Compared against when the email is unknown, so response time does not reveal which emails exist
const DUMMY_PASSWORD_HASH = bcrypt.hashSync(generateResetToken(), 10);

const profileInclude = [
	{
		model: Role,
		as: "admin_role",
		attributes: ["id", "name", "abbreviation"],
	},
	{
		model: Department,
		as: "admin_department",
		attributes: ["id", "name"],
	},
];

const signAdminToken = (admin) =>
	jwt.sign(
		{
			id: admin.id,
			role_id: admin.role_id,
			department_id: admin.department_id,
			type: tokenTypes.ADMIN,
		},
		config.jwt.secret,
		{ algorithm: "HS256", expiresIn: config.jwt.adminExpiration },
	);

const createAdminUser = async (userBody) => {
	// 16 random URL-safe characters; the admin is asked to change it after first login
	const password = crypto.randomBytes(12).toString("base64url");

	const adminId = await sequelize.transaction(async (transaction) => {
		const admin = await Admin.create(
			{
				name: userBody.name,
				email: userBody.email,
				password: await bcrypt.hash(password, 10),
				role_id: userBody.role_id,
				department_id: userBody.department_id,
			},
			{ transaction },
		);

		// Sending inside the transaction: if the email fails, the admin is not created
		const isSend = await sendAdminCredentials(userBody.email, password);
		if (!isSend) {
			throw new ApiError(
				httpStatus.INTERNAL_SERVER_ERROR,
				"Unable to send Credentials to This Email",
			);
		}
		return admin.id;
	});

	return Admin.findOne({
		attributes: ["id", "name", "email", "role_id", "department_id"],
		include: profileInclude,
		where: { id: adminId, is_active: true },
	});
};

const loginAdminUser = async (reqBody) => {
	const user = await Admin.findOne({
		where: { email: reqBody.email, is_active: true },
	});

	const validPass = await bcrypt.compare(
		String(reqBody.password),
		user && user.password ? user.password : DUMMY_PASSWORD_HASH,
	);
	if (!user || !user.password || !validPass) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Invalid email or password. Please try again.");
	}

	return {
		id: user.id,
		name: user.name,
		email: user.email,
		role_id: user.role_id,
		token: signAdminToken(user),
	};
};

const resetAdminPassword = async (reqBody) => {
	const { old_password, new_password, user } = reqBody;

	const userDoc = await Admin.findByPk(user.id);
	const validPass = userDoc?.password && (await bcrypt.compare(String(old_password), userDoc.password));
	if (!validPass) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Incorrect Old Password.");
	}

	// Changing the password ends all existing admin sessions; this client gets a new token
	await userDoc.update({
		password: await bcrypt.hash(new_password, 10),
		password_changed_at: new Date(),
	});
	return { token: signAdminToken(userDoc) };
};

const sendOTP = async (email) => {
	const user = await Admin.findOne({
		where: { email: email || "", is_active: true },
	});
	// Same response whether or not the account exists
	if (!user) return true;

	if (user.otp_expires_at) {
		const issuedAt = user.otp_expires_at.getTime() - config.otp.expirationMinutes * 60 * 1000;
		const waitMs = issuedAt + config.otp.resendCooldownSeconds * 1000 - Date.now();
		if (waitMs > 0) {
			throw new ApiError(
				httpStatus.TOO_MANY_REQUESTS,
				`Please wait ${Math.ceil(waitMs / 1000)} seconds before requesting a new OTP.`,
			);
		}
	}

	const code = generateOtp(config.otp.length);
	await user.update({
		otp: hashSecret(code),
		otp_expires_at: new Date(Date.now() + config.otp.expirationMinutes * 60 * 1000),
		otp_attempts: 0,
	});
	await sendForgotPasswordOTP(email, code);
	return true;
};

// Admin OTPs are only used for password reset: a correct code returns a short-lived reset token
const verifyOTP = async (email, otp) => {
	if (!email || !otp) {
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"Please Enter Required Fields : [email, otp]",
		);
	}

	const user = await Admin.findOne({ where: { email: email, is_active: true } });
	const usable =
		user &&
		user.otp &&
		user.is_otp_valid &&
		user.otp_expires_at &&
		user.otp_expires_at > new Date() &&
		user.otp_attempts < config.otp.maxAttempts;
	if (!usable) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Invalid or expired OTP. Please request a new one.");
	}

	if (!matchesHash(String(otp).trim(), user.otp)) {
		const attempts = user.otp_attempts + 1;
		if (attempts >= config.otp.maxAttempts) {
			await user.update({ otp: null, otp_attempts: attempts });
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"Too many incorrect attempts. Please request a new OTP.",
			);
		}
		await user.update({ otp_attempts: attempts });
		throw new ApiError(httpStatus.BAD_REQUEST, "Invalid OTP Entered");
	}

	const token = generateResetToken();
	await user.update({
		otp: null,
		otp_expires_at: null,
		otp_attempts: 0,
		remember_token: hashSecret(token),
		reset_token_expires_at: new Date(Date.now() + config.otp.resetTokenExpirationMinutes * 60 * 1000),
	});
	return { token };
};

const forgotAdminPassword = async (reqBody) => {
	const { email, password, confirm_password, token } = reqBody;
	if (!email || !password || !confirm_password || !token) {
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"Please Enter Required Fields : [ email, password, confirm_password, token ]",
		);
	}
	if (password !== confirm_password) {
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"New Password and Confirm Password Must Be Equal",
		);
	}
	if (!validatePassword(password)) {
		throw new ApiError(
			httpStatus.BAD_REQUEST,
			"Password should have a minimum length of 8 characters and must have at least 2 digits and No Blank Space",
		);
	}

	const user = await Admin.findOne({ where: { email: email, is_active: true } });
	const valid =
		user &&
		user.reset_token_expires_at &&
		user.reset_token_expires_at > new Date() &&
		matchesHash(String(token), user.remember_token);
	if (!valid) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Invalid Email or Token");
	}

	await user.update({
		password: await bcrypt.hash(password, 10),
		remember_token: null,
		reset_token_expires_at: null,
		password_changed_at: new Date(),
	});
	return "Password Changed Successfully.";
};

const getProfile = async (reqBody) => {
	const { user } = reqBody;
	const result = await Admin.findOne({
		attributes: ["id", "name", "email", "role_id", "department_id"],
		include: profileInclude,
		where: { id: user.id, is_active: true },
	});

	if (!result) {
		throw new ApiError(httpStatus.BAD_REQUEST, "Admin profile not found.");
	}

	return result;
};

module.exports = {
	createAdminUser,
	loginAdminUser,
	resetAdminPassword,
	sendOTP,
	verifyOTP,
	forgotAdminPassword,
	getProfile,
};
