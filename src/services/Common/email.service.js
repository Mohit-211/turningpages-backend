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
const { User, Profile, UserPromotion } = require("../../models");

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

const sendResetPasswordConfirmationMail = async (to) => {
	try {
		const subject = "Successfully Changed password";
		const text = `Dear user,
        Your Password Has Been changed Successfully
        If you did not request any password resets, then ignore this email.`;
		return await sendEmail(to, subject, text);
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

const sendReceiptToUser = async (to, receipt_url) => {
	const subject = "Your Subscription Receipt from Turning Pages";
	const text = `Dear User,

Thank you for your recent subscription to the Turning Pages! Your payment has been successfully processed, and we are delighted to have you with us for the next year.

Please find your receipt below:
Receipt URL: ${receipt_url}

If you have any questions or need assistance, feel free to reach out to our support team at cedrick.lafleur2@gmail.com.

Thank you for choosing Turning Pages. We wish you a successful and productive experience!

Best Regards,
Turning Pages Team`;

	return await sendEmail(to, subject, text);
};

const sendUserPremiumExpiredEmail = async (to) => {
	const subject =
		"Your CRM Premium Subscription Has Expired - Turning Pages App";
	const text = `Dear User,

    We hope you enjoyed using the Turning Pages CRM. However, your premium subscription has now expired. To continue managing your customers, appointments, and other features seamlessly, please renew your subscription.

    If you have any questions or need assistance, feel free to contact our support team at support@book _publishing.net.

    Best Regards,  
    Book Publishing Team`;

	return await sendEmail(to, subject, text);
};

const sendOrderConfirmationToSeller = async (
	seller,
	buyer,
	order,
	orderDetail,
	product,
) => {
	const subject = "New Order on Book Publishing! Time to Ship Your Product";

	const orderAmount = parseFloat(
		orderDetail.total_price || orderDetail.unit_price,
	).toFixed(2);
	const commission = (orderAmount * 0.1).toFixed(2);
	const payout = (orderAmount - commission).toFixed(2);
	const orderDate = moment(order.createdAt).format("MMMM Do YYYY");

	const text = `
Hi ${seller?.user_profile?.name},

Great news — one of your products has just been purchased through Book Publishing! 🛍️
Here are the next steps to fulfill your order:

Order Summary:
- Product Name: ${product.name}
- Buyer Name: ${buyer?.user_profile?.name}
- Order Date: ${orderDate}
- Order Total: $${orderAmount}
- Book Publishing Commission: 10%
- Your Estimated Payout: $${payout}

What To Do Next:
1. Ship the product within 1–2 business days
2. Log in to your Book Publishing account and input the tracking number in the order management section
3. Use a trackable shipping method (we recommend USPS, UPS, or FedEx)

Once tracking is submitted, both you and the buyer will receive updates on the order’s status.

Questions or Need Help?
Email us at support@book _publishing.net — we’re here to help.

Thanks for being a valued Book Publishing partner!
Let’s grow together.
`;

	await sendEmail(seller.email, subject, text);
};

const sendOrderConfirmationToBuyer = async (
	buyer,
	seller,
	order,
	orderDetail,
	product,
) => {
	const subject = "Thank You for Your Order on Book Publishing!";
	const orderDate = moment(order.createdAt).format("MMMM Do YYYY");
	const orderAmount = parseFloat(
		orderDetail.total_price || orderDetail.unit_price,
	).toFixed(2);

	const text = `
Hi ${buyer?.user_profile?.name},

Thanks for shopping on Book Publishing — your order has been received and is being processed! 🛍

Order Summary:
- Product Name: ${product.name}
- Order Date: ${orderDate}
- Order Total: $${orderAmount}
- Seller: ${seller?.user_profile?.name}
- Order Number: ${order.id}


⏳ Shipping Info:
Your product will be shipped within 1–2 business days. The seller is required to input a tracking number once shipped.
You will receive an update with tracking details as soon as it’s available.

Have a Question?
Please reach out directly to the seller through their Book Publishing profile. If you do not receive a response within 48 hours, contact us at support@book _publishing.net.

Thanks again for supporting trusted beauty professionals through Book Publishing!
Stay beautiful,  
The Book Publishing Team.
`;

	await sendEmail(buyer.email, subject, text);
};

const sendOrderNotificationToAdmin = async (
	buyer,
	seller,
	order,
	orderDetail,
	product,
) => {
	const subject = `📦 New Order Placed on Book Publishing`;
	const orderDate = moment(order.createdAt).format("MMMM Do YYYY");
	const orderAmount = parseFloat(
		orderDetail.total_price || orderDetail.unit_price,
	).toFixed(2);

	const text = `
Hello Admin,

A new order has been placed on the Book Publishing platform.

Order Details:
- Product Name: ${product.name}
- Order Date: ${orderDate}
- Order Total: $${orderAmount}

Buyer Details:
- Name: ${buyer?.user_profile?.name}
- Email: ${buyer.email}
- User ID: ${buyer.id}

Seller (Beautician) Details:
- Name: ${seller?.user_profile?.name}
- Email: ${seller.email}
- User ID: ${seller.id}

Please monitor this transaction for quality and delivery tracking.

Thanks,  
Book Publishing System
`;

	await sendEmail("anshita.varyani@blockcod.com", subject, text);
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

const sendUserDeletionEmail = async (userEmail) => {
	const subject = "Important: Your Book Publishing Account Has Been Deleted";
	const text = `Dear User,

We are reaching out to inform you that your account associated with Book Publishing has been deleted by an administrator. This action has resulted in the removal of your profile, posts, bookings, products, and other related data.

If you believe this action was taken in error, or if you have any questions, please contact our support team at support@book _publishing.net. We're here to help.

Warm regards,  
The Book Publishing Team`;

	return await sendEmail(userEmail, subject, text);
};

const sendUserDeletionSummaryToAdmin = async (userEmails = []) => {
	const subject = "Book Publishing Admin Alert: User Accounts Deleted";

	const text = `Hello Admin,

The following user account(s) have been permanently deleted from the Book Publishing platform:

${userEmails.map((email, index) => `${index + 1}. ${email}`).join("\n")}

All associated data has also been removed from the system.

Regards,  
Book Publishing System`;

	return await sendEmail("anshita.varyani@blockcod.com", subject, text);
};

const sendNewProductAlertToAdmin = async (beautician, product) => {
	const subject = `🆕 New Product Uploaded on Book Publishing (Pending Approval)`;

	const text = `
Hello Admin,

A new product has been uploaded by a beautician and is awaiting your approval.

Beautician Details:
• Name: ${beautician?.user_profile?.name || beautician?.email}
• Email: ${beautician.email}

Product Details:
• Name: ${product.name}
• Uploaded On: ${new Date(product.created_at).toLocaleString()}

Please review and take necessary action in the admin panel.

Thanks,  
Book Publishing System
`;

	await sendEmail("support@book _publishing.net", subject, text);
};

const sendProductApprovalEmail = async (
	recipientEmail,
	productName,
	status,
) => {
	const subject =
		status === "approved"
			? `🎉 Your Product "${productName}" has been Approved`
			: `⚠️ Your Product "${productName}" has been Rejected`;

	const text =
		status === "approved"
			? `Hi,

Great news! Your product "${productName}" has been successfully reviewed and approved by the Book Publishing admin team. 🎉

You can now see it live on the platform and start selling!

Warm regards,  
The Book Publishing Team`
			: `Hi,

Unfortunately, your product "${productName}" has been reviewed and rejected by the Book Publishing admin team. 😞

Please review our product listing guidelines and re-submit if necessary.

Warm regards,  
The Book Publishing Team`;

	await sendEmail(recipientEmail, subject, text);
};

const sendProductStatusNotificationToAdmin = async (
	productName,
	beauticianName,
	status,
) => {
	const subject = `Product "${productName}" has been ${status}`;
	const text = `Hello Admin,

The product "${productName}" listed by ${beauticianName} has been ${status}.

Thanks,  
Book Publishing System`;

	await sendEmail("support@book _publishing.net", subject, text);
};

const sendProductDeletionEmailToBeautician = async (
	beauticianEmail,
	beauticianName,
	productNames,
) => {
	const subject = `🚫 Product Deletion Notice – Book Publishing`;

	const text = `
Hi ${beauticianName},

We want to inform you that the following product(s) you listed on Book Publishing have been deleted from the platform:

${productNames.map((name) => `- ${name}`).join("\n")}

If you believe this was a mistake or would like more information, feel free to reach out to our support team at support@book _publishing.net.

Thank you,  
The Book Publishing Team
`;

	await sendEmail(beauticianEmail, subject, text);
};

const sendProductDeletionEmailToAdmin = async (deletedProductInfo) => {
	const subject = `🗑️ Products Deleted on Book Publishing`;

	const text = `
Hello Admin,

The following product(s) have been deleted from Book Publishing:

${deletedProductInfo
	.map((item) => `- "${item.productName}" by ${item.beauticianName}`)
	.join("\n")}

Best,  
Book Publishing System
`;

	await sendEmail("support@book _publishing.net", subject, text); // Replace with actual admin email
};

const sendFormSubmissionEmails = async (beauticianEmail, beauticianName) => {
	// ✅ Mail to Beautician
	const beauticianSubject = `📩 GlamLink Form Submitted`;
	const beauticianText = `
Hi ${beauticianName},

Thank you for submitting your applicant form on GlamLink.

Our team will review your submission, and you can expect a response within 24 hours.

If you have any questions, feel free to reach out to us at support@book _publishing.net.

Regards,  
The GlamLink Team
`;

	await sendEmail(beauticianEmail, beauticianSubject, beauticianText);

	// ✅ Mail to Admin
	const adminSubject = `📝 New Applicant Form Submission – ${beauticianName}`;
	const adminText = `
Hello Admin,

Beautician ${beauticianName} has submitted the applicant form on GlamLink.

Please review their responses via the Admin Dashboard.

Regards,  
The GlamLink System
`;

	await sendEmail("support@book _publishing.net", adminSubject, adminText); // Replace with real admin email if needed
};

const sendFormStatusUpdateEmails = async (
	beauticianName,
	beauticianEmail,
	status,
) => {
	// ✅ Email to Beautician
	const beauticianSubject =
		status === "approved"
			? "🎉 Your Application Has Been Approved – Book Publishing"
			: "⚠️ Your Application Was Rejected – Book Publishing";

	const beauticianText =
		status === "approved"
			? `
Hi ${beauticianName},

Congratulations! Your applicant form has been approved.

Your 7-day free trial on Book Publishing has started. You now have access to the full CRM features.

If you have any questions, feel free to reach out at support@book _publishing.net.

Best regards,  
The Book Publishing Team
`
			: `
Hi ${beauticianName},

We regret to inform you that your applicant form has been rejected after review.

You can log in to Book Publishing and resubmit the form if needed, or reach out to us at support@book _publishing.net for assistance.

Best regards,  
The Book Publishing Team
`;

	await sendEmail(beauticianEmail, beauticianSubject, beauticianText);

	// ✅ Email to Admin
	const adminSubject = `📄 Application ${
		status === "approved" ? "Approved" : "Rejected"
	} – ${beauticianName}`;
	const adminText = `
Hello Admin,

The application form submitted by ${beauticianName} has been **${status}**.

You can review their details from the Admin Dashboard.

Regards,  
The Book Publishing System
`;

	await sendEmail("support@book _publishing.net", adminSubject, adminText); // Update admin email if dynamic
};

const sendAppointmentEmails = async (appointment, timezone) => {
	const { user_id, counselor_id, date, start_time, end_time, service_id } =
		appointment;

	// Fetch user and beautician with profiles
	const [user, beautician] = await Promise.all([
		User.findByPk(user_id, {
			include: [{ model: Profile, as: "user_profile" }],
		}),
		User.findByPk(counselor_id, {
			include: [{ model: Profile, as: "user_profile" }],
		}),
	]);

	const userName = user?.user_profile?.name || "User";
	const userEmail = user?.email;

	const beauticianName = beautician?.user_profile?.name || "Beautician";
	const beauticianEmail = beautician?.email;

	// Admin static
	const adminEmail = "support@book _publishing.net";

	// Format time
	const formattedStart = `${date} ${start_time}`;
	const formattedEnd = `${date} ${end_time}`;

	// Subject
	const subject = `📅 Appointment Booked on Book Publishing`;

	// 📨 Email to User
	const userText = `
Hi ${userName},

Your appointment with ${beauticianName} has been successfully booked.

🗓 Date: ${date}  
🕒 Time: ${start_time} to ${end_time} (${timezone})  

You’ll receive updates and reminders as the appointment time approaches.

Thank you,  
The Book Publishing Team
`;

	await sendEmail(userEmail, subject, userText);

	// 📨 Email to Beautician
	const beauticianText = `
Hi ${beauticianName},

A new appointment has been booked by ${userName}.

🗓 Date: ${date}  
🕒 Time: ${start_time} to ${end_time} (${timezone})  

Please log in to your Book Publishing dashboard to review the booking.

Thanks,  
The Book Publishing Team
`;

	await sendEmail(beauticianEmail, subject, beauticianText);

	// 📨 Email to Admin
	const adminText = `
Hello Admin,

A new appointment has been scheduled.

👤 User: ${userName} (${userEmail})  
🎨 Beautician: ${beauticianName} (${beauticianEmail})  
🗓 Date: ${date}  
🕒 Time: ${start_time} to ${end_time} (${timezone})

You can view more details on the Admin Dashboard.

– Book Publishing System
`;

	await sendEmail(adminEmail, subject, adminText);
};

const sendPromotionPurchaseEmails = async (userId) => {
	try {
		// 🔎 Fetch user and profile
		const user = await User.findByPk(userId, {
			include: [{ model: Profile, as: "user_profile" }],
		});

		if (!user) throw new Error("User not found");

		const beauticianName = user.user_profile?.name || "Beautician";
		const beauticianEmail = user.email;

		const adminEmail = "support@book _publishing.net";

		// 🔎 Fetch promotion title
		const promotion = await UserPromotion.findOne({
			where: { user_id: userId },
		});

		const promotionTitle = promotion?.title || "your selected category";

		const subject = `🚀 Promotion Activated – Book Publishing`;

		// ✅ Email to Beautician
		const beauticianText = `
Hi ${beauticianName},

Congratulations! Your promotion for **${promotionTitle}** is now active on Book Publishing.

Your profile will now appear in the promoted section, gaining increased visibility in your chosen category.

Thank you for choosing Book Publishing to grow your business!

Best regards,  
The Book Publishing Team
`;

		await sendEmail(beauticianEmail, subject, beauticianText);

		// ✅ Email to Admin
		const adminText = `
Hello Admin,

A new promotion has been purchased by ${beauticianName}.

📌 Promotion Title: ${promotionTitle}  


– Book Publishing System
`;

		await sendEmail(adminEmail, subject, adminText);
	} catch (err) {
		console.error("❌ Failed to send promotion emails:", err);
	}
};

const sendSubscriptionSuccessEmails = async (userId) => {
	try {
		const user = await User.findByPk(userId, {
			include: [{ model: Profile, as: "user_profile" }],
		});

		if (!user) throw new Error("User not found");

		const beauticianName = user.user_profile?.name || "Beautician";
		const beauticianEmail = user.email;
		const adminEmail = "support@book _publishing.net";

		const subject = `✅ CRM Subscription Activated – Book Publishing`;

		// ✅ Beautician Email
		const beauticianText = `
Hi ${beauticianName},

Thank you for purchasing the Book Publishing CRM Subscription.

Your premium access is now active for the next 12 months. You can now access advanced features to grow and manage your beauty business more efficiently.

If you have any questions, feel free to reach out to us.

Best regards,  
The Book Publishing Team
`;

		// ✅ Admin Email
		const adminText = `
Hello Admin,

A CRM subscription has been successfully purchased.

👤 Beautician: ${beauticianName}  
📧 Email: ${beauticianEmail}  


– Book Publishing System
`;

		await sendEmail(beauticianEmail, subject, beauticianText);
		await sendEmail(adminEmail, subject, adminText);
	} catch (err) {
		console.error("❌ Failed to send subscription success emails:", err);
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
	sendResetPasswordConfirmationMail,
	sendEmailVerification,
	sendOrderConfirmationToSeller,
	sendOrderConfirmationToBuyer,
	sendUserCredentials,
	sendReceiptToUser,
	sendUserPremiumExpiredEmail,
	sendOTPMails,
	sendUserDeletionEmail,
	sendUserDeletionSummaryToAdmin,
	sendOrderNotificationToAdmin,
	sendNewProductAlertToAdmin,
	sendProductApprovalEmail,
	sendProductStatusNotificationToAdmin,
	sendProductDeletionEmailToBeautician,
	sendProductDeletionEmailToAdmin,
	sendFormSubmissionEmails,
	sendFormStatusUpdateEmails,
	sendAppointmentEmails,
	sendPromotionPurchaseEmails,
	sendSubscriptionSuccessEmails,
	sendAdminCredentials,
};
