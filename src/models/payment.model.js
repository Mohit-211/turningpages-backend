/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class Payment extends Model {}
Payment.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},

		user_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
		},


		payment_status: {
			type: DataTypes.ENUM("pending", "success", "failed"),
			defaultValue: "pending",
		},

		payment_gateway: {
			type: DataTypes.ENUM("razorpay", "stripe", "paypal"),
			defaultValue: "stripe",
		},

		gateway_payment_status: {
			type: DataTypes.ENUM("pending", "success", "failed"),
			defaultValue: "pending",
		},

		payment_mode: {
			type: DataTypes.ENUM("online", "offline"),
			defaultValue: "online",
		},

		payment_type: {
			type: DataTypes.ENUM('Subscription', 'One Time', 'Package'),
			defaultValue: "One Time",
		},
		payment_for: {
			type: DataTypes.ENUM("book_submission", "buy_credit", "package_purchase"),
			defaultValue: "buy_credit",
		},
		package_name: {
			type: DataTypes.STRING(100),
			allowNull: true,
		},

		stripe_customer_id: {
			type: DataTypes.STRING(255),
			allowNull: true,
		},

		currency: {
			type: DataTypes.ENUM("INR", "USD", "EUR"),
			defaultValue: "USD",
		},

		transaction_id: {
			type: DataTypes.STRING(255),
			defaultValue: "",
		},

		amount: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
		},

		credit: {
			type: DataTypes.INTEGER,
			defaultValue: 0,
		},

		receipt_url: {
			type: DataTypes.STRING(500),
			defaultValue: null,
		},

		is_refunded: {
			type: DataTypes.BOOLEAN,
			defaultValue: false,
		},

		refund_reason: {
			type: DataTypes.STRING(500),
			defaultValue: "",
		},
		metadata: {
			type: DataTypes.JSON,
			allowNull: true,
			defaultValue: null,
		},

		is_active: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},

		created_by: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true,
		},

		updated_by: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true,
		},

		deleted_by: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: true,
		},
	},
	{
		sequelize,
		tableName: "payments",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	},
);

Payment.beforeUpdate((profile) => {
	profile.updated_at = new Date();
});

Payment.beforeDestroy((profile) => {
	profile.deleted_at = new Date();
	profile.is_active = false;
});

module.exports = Payment;
