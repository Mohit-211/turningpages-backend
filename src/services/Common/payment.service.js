/** @format */

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const httpStatus = require("http-status");
const {
  Chapter,
  Genre,
  Book,
  User,
  Payment,
  UserCreditSpending,
  BookSubmissionRequest,
  Profile,
  UserSubscription,
} = require("../../models");
const ApiError = require("../../utils/ApiError");
const config = require("../../config/config");
const { STRIPE_PRICE_MAP, CREDIT_PACKAGES } = require("../../config/credits");

const PACKAGE_PRICES = {
  starter: 29,
  author: 59,
  pro_author: 99,
  studio: 179,
};

// const getStripePaymentIntent = async (body) => {
// 	try {
// 		const { amount, credit, user, payment_for, book_submission_id } = body;

// 		if (amount === undefined || payment_for === undefined) {
// 			throw new ApiError(
// 				httpStatus.BAD_REQUEST,
// 				"Please provide required fields: amount and payment_for",
// 			);
// 		}
// 		if (Number.isNaN(Number(amount)) || amount <= 0) {
// 			throw new ApiError(
// 				httpStatus.BAD_REQUEST,
// 				"amount must be valid numbers or positive integers",
// 			);
// 		}
// 		if (!["book_submission", "buy_credit"].includes(payment_for)) {
// 			throw new ApiError(
// 				httpStatus.BAD_REQUEST,
// 				"Invalid value of payment_for",
// 			);
// 		}

// 		const metadata = {
// 			user_id: user.id,
// 			payment_for,
// 			credit: 0,
// 		};
// 		if (payment_for === "buy_credit") {
// 			if (credit === undefined) {
// 				throw new ApiError(
// 					httpStatus.BAD_REQUEST,
// 					"Please provide required fields: credit",
// 				);
// 			}
// 			if (Number.isNaN(Number(credit))) {
// 				throw new ApiError(
// 					httpStatus.BAD_REQUEST,
// 					"credit must be valid numbers",
// 				);
// 			}
// 			if (credit <= 0) {
// 				throw new ApiError(
// 					httpStatus.BAD_REQUEST,
// 					"credit must be positive integers",
// 				);
// 			}
// 			metadata["credit"] = credit;
// 		} else if (payment_for === "book_submission") {
// 			if (book_submission_id === undefined) {
// 				throw new ApiError(
// 					httpStatus.BAD_REQUEST,
// 					"Please provide required fields: book_submission_id",
// 				);
// 			}

// 			const bookSubmissionDoc = await BookSubmissionRequest.findOne({
// 				where: { id: book_submission_id },
// 			});
// 			if (!bookSubmissionDoc) {
// 				throw new ApiError(
// 					httpStatus.BAD_REQUEST,
// 					"Invalid book_submission_id",
// 				);
// 			}
// 			metadata["book_submission_id"] = book_submission_id;
// 		}

// 		let stripeCustomer;
// 		const existingCustomers = await stripe.customers.list({
// 			email: user.email,
// 			limit: 1,
// 		});
// 		if (existingCustomers.data.length > 0) {
// 			stripeCustomer = existingCustomers.data[0];
// 		} else {
// 			stripeCustomer = await stripe.customers.create({
// 				email: user.email,
// 				name: `${user?.user_profile?.name}`,
// 			});
// 		}
// 		await User.update(
// 			{ stripe_customer_id: stripeCustomer.id },
// 			{ where: { id: user.id } },
// 		);
// 		const rawAmount = Number(amount);
// 		const rawCredit = payment_for === "book_submission" ? 0 : Number(credit);

// 		const paymentIntent = await stripe.paymentIntents.create({
// 			amount: Math.round(rawAmount * 100), // cents
// 			currency: "usd",
// 			customer: stripeCustomer.id,
// 			description: "Turning Page credit purchase",
// 			setup_future_usage: "off_session",
// 			metadata: metadata,
// 			shipping: {
// 				name: user?.user_profile?.name || "",
// 				address: {
// 					line1: user.address || "",
// 				},
// 			},
// 			automatic_payment_methods: {
// 				enabled: true,
// 			},
// 		});

// 		const paymentDoc = await Payment.create({
// 			user_id: user.id,
// 			payment_status: "pending",
// 			payment_gateway: "stripe",
// 			gateway_payment_status: "pending",
// 			payment_mode: "online",
// 			amount: rawAmount,
// 			credit: payment_for === "book_submission" ? 0 : rawCredit,
// 			transaction_id: paymentIntent.id,
// 			currency: "USD",
// 			payment_for: payment_for,
// 			metadata: {
// 				book_submission_id,
// 			},
// 		});

// 		return {
// 			client_secret: paymentIntent.client_secret,
// 			payment_id: paymentDoc.id,
// 			stripe_payment_intent_id: paymentIntent.id,
// 		};
// 	} catch (error) {
// 		throw new ApiError(
// 			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
// 			error.message,
// 		);
// 	}
// };

const getStripePaymentIntent = async (body) => {
  try {
    const { amount, package_name, user } = body;
    console.log(body, "body");

    // ✅ validation
    if (!amount || !package_name) {
      throw new ApiError(400, "amount and package_name are required");
    }

    if (Number(amount) <= 0) {
      throw new ApiError(400, "Invalid amount");
    }

    // ================================
    // 👤 CUSTOMER
    // ================================
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
        name: user?.user_profile?.name || "",
      });
    }

    await User.update(
      { stripe_customer_id: stripeCustomer.id },
      { where: { id: user.id } },
    );

    // ================================
    // 💳 CREATE PAYMENT INTENT
    // ================================
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(Number(amount) * 100),
      currency: "usd",
      customer: stripeCustomer.id,
      description: `Package purchase: ${package_name}`,
      metadata: {
        user_id: user.id,
        package_name,
        type: "package_purchase", // 🔥 important
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // ================================
    // 🗄 SAVE IN DB
    // ================================
    const paymentDoc = await Payment.create({
      user_id: user.id,
      amount: amount,
      payment_status: "pending",
      gateway_payment_status: "pending",
      payment_gateway: "stripe",
      payment_mode: "online",
      transaction_id: paymentIntent.id,
      currency: "USD",
      payment_for: "package_purchase",

      package_name: package_name, // ✅ MUST

      stripe_customer_id: stripeCustomer.id, // ✅ OPTIONAL (recommended)

      metadata: {
        package_name,
      },
    });

    return {
      client_secret: paymentIntent.client_secret,
      payment_id: paymentDoc.id,
      stripe_payment_intent_id: paymentIntent.id,
    };
  } catch (error) {
    throw new ApiError(error.statusCode || 500, error.message);
  }
};

const stripeWebhook = async (body, headers) => {
  const sig = headers["stripe-signature"];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      config.STRIPE_WEBHOOK_SECRET_INTENT_CHARGE,
    );
  } catch (err) {
    console.error("Stripe webhook signature verification failed:", err.message);
    throw new ApiError(httpStatus.BAD_REQUEST, `Webhook Error: ${err.message}`);
  }

  try {
    const data = event.data.object;

    console.log(data, "datatttttttttttttttttttttttttttt");
    console.log(event.type, "event.type======================");

    switch (event.type) {
      case "payment_intent.payment_failed": {
        const paymentIntentId = data.id;

        await Payment.update(
          {
            payment_status: "failed",
            gateway_payment_status: "failed",
          },
          { where: { transaction_id: paymentIntentId } },
        );

        break;
      }

      case "payment_intent.succeeded": {
        const paymentIntent = data;

        const payment = await Payment.findOne({
          where: { transaction_id: paymentIntent.id },
        });

        if (!payment) {
          console.log("❌ Payment not found");
          break;
        }

        // ✅ prevent duplicate
        if (payment.payment_status === "success") break;

        await Payment.update(
          {
            payment_status: "success",
            gateway_payment_status: "success",
          },
          { where: { id: payment.id } },
        );

        console.log("✅ Package payment successful");

        break;
      }

      // case "payment_intent.succeeded": {
      // 	const paymentIntentId = data.id;
      // 	const metadata = data.metadata;
      // 	console.log("Metadata:", metadata);
      // 	const payment = await Payment.findOne({
      // 		where: { transaction_id: paymentIntentId },
      // 	});

      // 	// if (!payment) {
      // 	// 	console.warn("Payment record not found for intent:", paymentIntentId);
      // 	// 	break;
      // 	// }

      // 	// Idempotency check (VERY IMPORTANT)
      // 	if (payment.payment_status === "success") {
      // 		break;
      // 	}

      // 	const charge = data.charges?.data?.[0];

      // 	await Payment.update(
      // 		{
      // 			payment_status: "success",
      // 			gateway_payment_status: "success",
      // 			receipt_url: charge?.receipt_url || "",
      // 		},
      // 		{ where: { id: payment.id } },
      // 	);

      // 	if (metadata.payment_for === "buy_credit") {
      // 		await User.increment(
      // 			{ total_credit: payment.credit },
      // 			{ where: { id: payment.user_id } },
      // 		);
      // 		// ✅ Save last purchased package
      // 		if (payment.metadata?.package_name) {
      // 			await User.update(
      // 				{ package_name: payment.metadata.package_name },
      // 				{ where: { id: payment.user_id } },
      // 			);
      // 		}
      // 	} else if (metadata.payment_for === "book_submission") {
      // 		const book_submission_id = metadata.book_submission_id;
      // 		await BookSubmissionRequest.update(
      // 			{
      // 				payment_status: "success",
      // 			},
      // 			{ where: { id: book_submission_id } },
      // 		);
      // 	}
      // 	break;
      // }

      // case "payment_intent.canceled": {
      // 	const paymentIntentId = data.id;

      // 	await Payment.update(
      // 		{
      // 			payment_status: "failed",
      // 			gateway_payment_status: "failed",
      // 		},
      // 		{ where: { transaction_id: paymentIntentId } },
      // 	);

      // 	break;
      // }

      // case "charge.refunded": {
      // 	const charge = data;
      // 	const paymentIntentId = charge.payment_intent;

      // 	await Payment.update(
      // 		{
      // 			is_refunded: true,
      // 			payment_status: "failed",
      // 		},
      // 		{ where: { transaction_id: paymentIntentId } },
      // 	);

      // 	break;
      // }

      case "invoice.payment_failed": {
        const invoice = event.data.object;

        const paymentIntentId = invoice.payment_intent;

        await Payment.update(
          {
            payment_status: "failed",
            gateway_payment_status: "failed",
          },
          { where: { transaction_id: paymentIntentId } },
        );

        console.log("❌ Subscription payment failed");

        break;
      }

      case "payment_intent.canceled": {
        const paymentIntentId = data.id;

        await Payment.update(
          {
            payment_status: "failed",
            gateway_payment_status: "failed",
          },
          { where: { transaction_id: paymentIntentId } },
        );

        console.log("❌ Payment canceled");

        break;
      }

      case "invoice.payment_succeeded": {
        const invoice = event.data.object;

        const subscriptionId =
          invoice.subscription ||
          invoice.parent?.subscription_details?.subscription;

        if (!subscriptionId) break;

        const subscription =
          await stripe.subscriptions.retrieve(subscriptionId);

        const priceId = subscription.items.data[0].price.id;

        const package_name = Object.keys(STRIPE_PRICE_MAP).find(
          (key) => STRIPE_PRICE_MAP[key] === priceId,
        );

        const plan = CREDIT_PACKAGES[package_name];

        const user = await User.findOne({
          where: { stripe_customer_id: invoice.customer },
        });

        if (!user || !plan) break;

        // ✅ ALWAYS ADD CREDIT
        await User.increment(
          { total_credit: plan.credit },
          { where: { id: user.id } },
        );

        // 🔥 VERY IMPORTANT
        const billingReason = invoice.billing_reason;

        console.log("🔥 billingReason:", billingReason);

        // ================================
        // 🟢 CASE 1: FIRST TIME PURCHASE
        // ================================
        if (billingReason === "subscription_create") {
          await UserSubscription.create({
            user_id: user.id,
            stripe_subscription_id: subscriptionId,
            stripe_price_id: priceId,
            package_name,
            status: "active",
            current_period_start: new Date(
              subscription.current_period_start * 1000,
            ),
            current_period_end: new Date(
              subscription.current_period_end * 1000,
            ),
          });

          console.log("✅ First subscription created");
        }

        // ================================
        // 🔵 CASE 2: RENEWAL
        // ================================
        else if (billingReason === "subscription_cycle") {
          // expire old
          await UserSubscription.update(
            { status: "expired" },
            {
              where: {
                user_id: user.id,
                status: "active",
              },
            },
          );

          // check scheduled
          const scheduledPlan = await UserSubscription.findOne({
            where: {
              user_id: user.id,
              status: "scheduled",
            },
          });

          if (scheduledPlan) {
            // activate scheduled
            await UserSubscription.update(
              {
                status: "active",
                current_period_start: new Date(
                  subscription.current_period_start * 1000,
                ),
                current_period_end: new Date(
                  subscription.current_period_end * 1000,
                ),
              },
              { where: { id: scheduledPlan.id } },
            );

            console.log("✅ Scheduled plan activated");
          } else {
            // normal renewal
            await UserSubscription.create({
              user_id: user.id,
              stripe_subscription_id: subscriptionId,
              stripe_price_id: priceId,
              package_name,
              status: "active",
              current_period_start: new Date(
                subscription.current_period_start * 1000,
              ),
              current_period_end: new Date(
                subscription.current_period_end * 1000,
              ),
            });

            console.log("✅ Renewal created");
          }
        }

        // ================================
        // 🟡 CASE 3: PLAN UPDATE (UPGRADE)
        // ================================
        else if (billingReason === "subscription_update") {
          console.log("⚡ Plan updated — no DB change now");
          // DO NOTHING → already handled in upgrade API
        }

        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object;

        await UserSubscription.update(
          {
            status: "canceled",
          },
          {
            where: {
              stripe_subscription_id: subscription.id,
              status: "active",
            },
          },
        );

        console.log("✅ Subscription fully canceled");

        break;
      }
      default:
        console.info(`Unhandled Stripe event type: ${event.type}`);
    }

    return { received: true };
  } catch (error) {
    console.error("Stripe webhook processing error:", error);
    throw new ApiError(
      httpStatus.INTERNAL_SERVER_ERROR,
      `Webhook handler failed`,
    );
  }
};

const getAllPayments = async (body) => {
  try {
    const { user } = body;

    // ✅ Fetch payments
    const payments = await Payment.findAll({
      where: { is_active: true, user_id: user.id },
    });

    // ✅ Fetch subscriptions
    const subscriptions = await UserSubscription.findAll({
      where: { user_id: user.id },
      order: [["created_at", "DESC"]],
    });

    // ✅ Format subscriptions like payments
    const formattedSubscriptions = subscriptions.map((sub) => {
      const packageName = sub.package_name;

      const amount = PACKAGE_PRICES[packageName] || 0;
      const credit = CREDIT_PACKAGES[packageName]?.credit || 0;

      return {
        id: sub.id,
        user_id: sub.user_id,
        payment_status: sub.status === "active" ? "success" : "pending",
        payment_gateway: "stripe",
        gateway_payment_status: sub.status,
        payment_mode: "online",
        payment_type: "Subscription",
        payment_for: "subscription",
        package_name: packageName,
        stripe_customer_id: null,
        currency: "USD",
        transaction_id: sub.stripe_subscription_id,

        amount,
        credit,

        receipt_url: null,
        is_refunded: false,
        refund_reason: "",

        metadata: JSON.stringify({
          price_id: sub.stripe_price_id,
          amount, // ✅ fixed
          credit,
          current_period_start: sub.current_period_start,
          current_period_end: sub.current_period_end,
        }),

        is_active: sub.is_active,
        created_by: sub.created_by,
        updated_by: sub.updated_by,
        deleted_by: sub.deleted_by,
        created_at: sub.created_at,
        updated_at: sub.updated_at,
        deleted_at: sub.deleted_at,
        source: "subscription",
      };
    });

    // ✅ Merge + sort
    const mergedData = [...payments, ...formattedSubscriptions].sort(
      (a, b) => new Date(b.created_at) - new Date(a.created_at),
    );

    return mergedData;
  } catch (error) {
    throw new ApiError(
      error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

// const getAllPayments = async (body) => {
// 	try {
// 		const { user } = body;

// 		const paymentDocs = await Payment.findAll({
// 			where: { is_active: true, user_id: user.id },
// 		});
// 		if (!paymentDocs) {
// 			throw new ApiError(
// 				httpStatus.BAD_REQUEST,
// 				"Failed to fetch payments list",
// 			);
// 		}

// 		return paymentDocs;
// 	} catch (error) {
// 		throw new ApiError(
// 			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
// 			error.message,
// 		);
// 	}
// };

const getPaymentDetails = async (body) => {
  try {
    const { payment_id, user } = body;

    if (!payment_id) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Please provide payment_id");
    }

    const paymentDoc = await Payment.findOne({
      where: { is_active: true, user_id: user.id, id: payment_id },
    });
    if (!paymentDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "Payment details not found");
    }

    return paymentDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getCreditSpentList = async (body) => {
  try {
    const { user } = body;

    const spentDoc = await UserCreditSpending.findAll({
      where: { is_active: true, user_id: user.id },
    });
    if (!spentDoc) {
      throw new ApiError(httpStatus.BAD_REQUEST, "List not found");
    }

    return spentDoc;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

const getAllPaymentList = async () => {
  try {
    const paymentDocs = await Payment.findAll({
      where: { is_active: true, payment_status: "success" },
      include: [
        {
          model: User,
          as: "payment_user",
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
    });
    if (!paymentDocs) {
      throw new ApiError(
        httpStatus.BAD_REQUEST,
        "Failed to fetch payments list",
      );
    }

    return paymentDocs;
  } catch (error) {
    throw new ApiError(
      error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
      error.message,
    );
  }
};

module.exports = {
  getStripePaymentIntent,
  stripeWebhook,
  getAllPayments,
  getPaymentDetails,
  getCreditSpentList,
  getAllPaymentList,
};
