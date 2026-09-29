const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class UserCreditTransaction extends Model {}

UserCreditTransaction.init(
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

    admin_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: true,
    },

    transaction_type: {
      type: DataTypes.ENUM(
        "ADD",
        "REDUCE",
        "SUBSCRIPTION",
        "BONUS",
        "REFUND"
      ),
      allowNull: false,
    },

    credits: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    balance_before: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    balance_after: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    is_active: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },

    created_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
    },

    updated_at: {
      type: DataTypes.DATE,
      defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
      onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
    },

    deleted_at: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    tableName: "user_credit_transactions",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  }
);

UserCreditTransaction.beforeUpdate((record) => {
  record.updated_at = new Date();
});

UserCreditTransaction.beforeDestroy((record) => {
  record.deleted_at = new Date();
  record.is_active = false;
});

module.exports = UserCreditTransaction;