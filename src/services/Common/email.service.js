/** @format */

const nodemailer = require("nodemailer");
const config = require("../../config/config");
const logger = require("../../config/logger");
const {
	forgotPasswordSendOTPFormat,
	emailVerificationFormat,
} = require("../../../public/Email_Template");
const ApiError = require("../../utils/ApiError");
const httpStatus = require("http-status");

const transport = nodemailer.createTransport(config.email.smtp);

if (config.env !== "test") {
	transport
		.verify()
		.then(() => logger.info("Connected to email server successfully😊."))
		.catch((error) => {
    logger.warn(
        `Unable to connect to email server: ${error.message}`,
    );
});
}

const sendEmail = async (to, subject, text) => {
	try {
		const msg = { from: config.email.from, to, subject, text };
		return await transport.sendMail(msg);
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const sendEmailVerification = async (to, otp) => {
	try {
		const message = {
			from: `${config.email.from}`,
			to: `${to}`,
			subject: "Please verify your email",
			text: `Please click on the following link to verify your email`,
			html: `${emailVerificationFormat(otp)}`,
		};
		transport.sendMail(message, (error, info) => {
			if (error) {
				console.log("Email sent error:  ", error);
				return false;
			} else {
				return true;
			}
		});
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const sendForgotPasswordOTP = async (to, otp) => {
	try {
		const message = {
			from: `${config.email.from}`,
			to: `${to}`,
			subject: "Forget Password Request",
			text: `Please click on the following link to verify your email`,
			html: `${forgotPasswordSendOTPFormat(otp)}`,
		};
		transport.sendMail(message, (error, info) => {
			if (error) {
				console.log("Email sent error:  ", error);
				return false;
			} else {
				return true;
			}
		});
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const sendUserCredentials = async (to, password) => {
	const subject = "Welcome to Turning Pages: Your Login Credentials";
	const text = `Dear User,
    
    Welcome to the Turning Pages! Our admin has successfully registered you. Please find your login credentials below.
    Now, get ready to embark on an exciting journey of creativity! 
    To access your account, please visit our secure login page with your login credentials below:
  

    Email Address: ${to}
    Password: ${password}
    
    Remember to keep these details safe and secure! 
    If you have any issues or have additional questions, please send an email to cedrick.lafleur2@gmail.com
    
    Best Regards,
    Turning Pages Team`;

	return await sendEmail(to, subject, text);
};

const sendOTPMails = async (email) => {
	// 1. Email to user
	const userSubject = "Welcome to Turning Pages!";
	const userText = `Dear User,

Thank you for signing up to Turning Pages! We're excited to have you on board.

You can now explore the platform, discover content, and start your journey with us.

If you face any issues or have any questions, feel free to reach out to us at support@turningpages.io.

Enjoy your Turning Pages experience!

Best Regards,  
Turning Pages Team`;

	try {
		await sendEmail(email, userSubject, userText);
	} catch (err) {
		console.error("User email failed:", err.message);
	}

	// 2. Email to admin
	const adminSubject = "New User Signup - Turning Pages";
	const adminText = `Hello Admin,

A new user has successfully signed up on Turning Pages.

Details:
• Email: ${email}
• Signup Time: ${new Date().toLocaleString()}

This is an automated notification for your records.

Best Regards,  
Turning Pages System`;

	try {
		await sendEmail("cedrick.lafleur2@gmail.com", adminSubject, adminText);
	} catch (err) {
		console.error("Admin email failed:", err.message);
	}
};

const sendAdminCredentials = async (to, password) => {
	const subject = "Welcome to Book Publishing: Your Login Credentials";
	const text = `Dear User,
    
    Welcome to Book Publishing! You have been successfully registered by our admin. Please find your login credentials below:
    
    Email Address: ${to}
    Temporary Password: ${password}
  
    
    For security reasons, we highly recommend changing your password after your first login.
    
    Best Regards,
    Book Publishing System`;
	return await sendEmail(to, subject, text);
};

module.exports = {
	sendForgotPasswordOTP,
	sendEmailVerification,
	sendUserCredentials,
	sendOTPMails,
	sendAdminCredentials,
};
