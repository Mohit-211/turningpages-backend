/** @format */

const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");
const { userStatusTypes } = require("../config/types");
const crypto = require("crypto");

class User extends Model {}
User.init(
  {
    id: {
      type: DataTypes.BIGINT.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    email: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    role_id: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stripe_customer_id: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    fcm_token: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    total_credit: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0,
    },
    package_name: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    square_customer_id: {
      type: DataTypes.STRING(200),
      allowNull: true,
    },
    socket_id: {
      type: DataTypes.STRING(150),
      allowNull: true,
    },
    referral_code: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    referred_by: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },
    referral_count: {
      type: DataTypes.INTEGER,
      defaultValue: 0,
    },
    referral_rewards: {
      type: DataTypes.DECIMAL(10, 2),
      defaultValue: 0.0,
    },
    status: {
      type: DataTypes.ENUM,
      values: [
        userStatusTypes.ACCEPTED,
        userStatusTypes.PENDING,
        userStatusTypes.REJECTED,
        userStatusTypes.REVIEWED,
        userStatusTypes.REVIEWING,
      ],
      defaultValue: userStatusTypes.PENDING,
    },
    provider: {
      type: DataTypes.ENUM,
      values: ["google", "facebook", "apple"],
      allowNull: true,
    },
    provider_id: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    latitude: {
      type: Sequelize.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: Sequelize.FLOAT,
      allowNull: true,
    },
    notification_status: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    created_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    created_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    updated_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    updated_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
    },
    deleted_by: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "users",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  },
);

User.afterCreate(async (user, options) => {
	user.socket_id = `${user.role_id}-${user.id}-socketId`;
	user.referral_code = `tp${crypto.randomBytes(4).toString("hex")}`; // e.g. tp9f3a1c2e

	// Reuse the caller's transaction (if any) so the save doesn't block on the
	// row lock held by the INSERT that triggered this hook
	await user.save({ transaction: options.transaction });
});

User.isEmailTaken = async function (email, role_id) {
  let u = await this.findOne({
    where: { email: email, role_id: role_id, is_active: true },
  });
  return !!u;
};

User.beforeUpdate(async (user) => {
  user.updated_at = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/g, "");
});

User.beforeDestroy(async (user) => {
  user.deleted_at = new Date()
    .toISOString()
    .replace(/T/, " ")
    .replace(/\..+/g, "");
  user.is_active = false;
});

module.exports = User;
