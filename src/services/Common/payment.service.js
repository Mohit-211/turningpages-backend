/** @format */

const Stripe = require("stripe");
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { status: httpStatus } = require("http-status");
const {
	User,
	Payment,
	UserCreditSpending,
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

const getStripePaymentIntent = async (body) => {
  try {
    const { amount, package_name, user } = body;

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
console.log("STRIPE EVENT TYPE:", event?.type);

if (!event?.data?.object) {
  console.log("Stripe event has no data.object:", event?.type);
  return { received: true };
}

const data = event.data.object;


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
    console.error("Stripe webhook processing error:", error.message);
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
