const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class UserSubscription extends Model {}

UserSubscription.init(
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

    stripe_subscription_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    stripe_price_id: {
      type: DataTypes.STRING(255),
      allowNull: false,
    },

    package_name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },

    status: {
      type: DataTypes.ENUM('active', 'canceled', 'incomplete'),
      defaultValue: 'active',
    },

    current_period_start: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    current_period_end: {
      type: DataTypes.DATE,
      allowNull: true,
    },

    cancel_at_period_end: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
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
    tableName: 'user_subscriptions',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at',
  }
);

UserSubscription.beforeUpdate((obj) => {
  obj.updated_at = new Date();
});

UserSubscription.beforeDestroy((obj) => {
  obj.deleted_at = new Date();
  obj.is_active = false;
});

module.exports = UserSubscription;