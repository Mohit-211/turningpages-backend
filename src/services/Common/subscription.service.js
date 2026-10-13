/** @format */

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { status: httpStatus } = require("http-status");

const ApiError = require("../../utils/ApiError");
const { User, UserSubscription, Profile } = require("../../models");
const { STRIPE_PRICE_MAP } = require("../../config/credits");

const createSubscription = async (body) => {
	try {
		const { user, package_name } = body;

		const priceId = STRIPE_PRICE_MAP[package_name];

		if (!priceId) {
			throw new ApiError(httpStatus.BAD_REQUEST, "Invalid package");
		}

		// get or create customer
		let stripeCustomer;

		const existingCustomers = await stripe.customers.list({
			email: user.email,
			limit: 1,
		});

		if (existingCustomers.data.length > 0) {
			stripeCustomer = existingCustomers.data[0];
		} else {
			stripeCustomer = await stripe.customers.create({
				email: user.email,
				name: user?.user_profile?.name,
			});
		}

		await User.update(
			{ stripe_customer_id: stripeCustomer.id },
			{ where: { id: user.id } },
		);

		// create subscription
		const subscription = await stripe.subscriptions.create({
			customer: stripeCustomer.id,
			items: [{ price: priceId }],
			payment_behavior: "default_incomplete",
			payment_settings: {
				save_default_payment_method: "on_subscription", // 🔥 IMPORTANT
			},
			expand: ["latest_invoice.payment_intent"],
		});

		return {
			client_secret: subscription.latest_invoice.payment_intent.client_secret,
			subscription_id: subscription.id,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const upgradeSubscription = async (body) => {
	try {
		const { user, package_name } = body;

		// 🔍 1. Get active subscription (current plan)
		const activeSubscription = await UserSubscription.findOne({
			where: {
				user_id: user.id,
				status: "active",
			},
		});

		if (!activeSubscription) {
			throw new ApiError(400, "No active subscription found");
		}

		// 🔍 2. Get Stripe subscription
		const stripeSub = await stripe.subscriptions.retrieve(
			activeSubscription.stripe_subscription_id,
		);

		const itemId = stripeSub.items.data[0].id;

		const newPriceId = STRIPE_PRICE_MAP[package_name];

		if (!newPriceId) {
			throw new ApiError(400, "Invalid package name");
		}

		// ⚠️ Prevent upgrading to same plan
		if (activeSubscription.package_name === package_name) {
			throw new ApiError(400, "You are already on this plan");
		}

		// 🔥 3. Update Stripe (schedule upgrade for next cycle)
		await stripe.subscriptions.update(
			activeSubscription.stripe_subscription_id,
			{
				items: [
					{
						id: itemId,
						price: newPriceId,
					},
				],
				proration_behavior: "none", // upgrade next cycle
			},
		);

		// 🔥 4. Remove any existing scheduled upgrade (avoid duplicates)
		await UserSubscription.destroy({
			where: {
				user_id: user.id,
				status: "scheduled",
			},
		});

		// 🔥 5. Create NEW scheduled row (future plan)
		await UserSubscription.create({
			user_id: user.id,
			stripe_subscription_id: activeSubscription.stripe_subscription_id,
			stripe_price_id: newPriceId,
			package_name,
			status: "scheduled",
			start_date: new Date(stripeSub.current_period_end * 1000),
			end_date: new Date(
				(stripeSub.current_period_end + 30 * 24 * 60 * 60) * 1000,
			), // approx next month
		});

		return {
			message:
				"✅ Upgrade scheduled successfully. It will apply on next billing cycle.",
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const cancelSubscription = async (body) => {
	try {
		const { user } = body;

		const subscription = await UserSubscription.findOne({
			where: { user_id: user.id, status: "active" },
		});

		if (!subscription) {
			throw new ApiError(400, "No active subscription");
		}

		// 🔥 Cancel in Stripe (at period end)
		await stripe.subscriptions.update(subscription.stripe_subscription_id, {
			cancel_at_period_end: true,
		});

		// 🔥 UPDATE DB (IMPORTANT)
		await UserSubscription.update(
			{
				cancel_at_period_end: true,
				is_cancelled: true, 
				cancelled_at: new Date(),
				status: "active", 
			},
			{
				where: { id: subscription.id },
			},
		);

		return {
			message: "Subscription will cancel at period end",
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const getUserSubscriptions = async (body) => {
	try {
		const { user } = body;
		const subscriptions = await UserSubscription.findAll({
			where: { user_id: user.id },
			order: [["created_at", "DESC"]],
		});

		return subscriptions;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const getAllSubscriptions = async () => {
	try {
		const subscriptions = await UserSubscription.findAll({
			where: { is_active: true },
			include: [
				{
					model: User,
					as: "subscription_user",
					attributes: ["id", "email"],
					include: [
						{
							model: Profile,
							as: "user_profile",
							attributes: ["name"],
						},
					],
				},
			],
			order: [["created_at", "DESC"]],
		});

		return subscriptions;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

module.exports = {
	createSubscription,
	upgradeSubscription,
	cancelSubscription,
	getUserSubscriptions,
	getAllSubscriptions,
};
