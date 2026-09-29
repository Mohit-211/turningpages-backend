const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class UserCreditSpending extends Model {}

UserCreditSpending.init(
  {
    id: {
      type: DataTypes.BIGINT,
      autoIncrement: true,
      primaryKey: true,
    },

    user_id: {
      type: DataTypes.BIGINT.UNSIGNED,
      allowNull: false,
    },

    credit_spent: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 1.0,
    },

    remaining_credit: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
    },

    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },

    event_name: {
      type: DataTypes.ENUM(
        "create_chapter",
        "update_chapter",
        "fact_checking",
        "plagiarism",
        "generate_summary",
        "consistency_check",
        "generate_chapter_content"
      ),
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
    tableName: "user_credit_spendings",
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  },
);

UserCreditSpending.beforeUpdate((ticket) => {
  ticket.updated_at = new Date();
});

UserCreditSpending.beforeDestroy((ticket) => {
  ticket.deleted_at = new Date();
  ticket.is_active = false;
});

module.exports = UserCreditSpending;
