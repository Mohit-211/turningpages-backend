const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class UserFeedLike extends Model { }

UserFeedLike.init({
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'User who created the ticket'
    },
    feed_id: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: 'Feed Post Id'
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true
    }

}, {
    sequelize,
    tableName: 'user_feed_likes',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

UserFeedLike.beforeUpdate(ticket => {
    ticket.updated_at = new Date();
});

UserFeedLike.beforeDestroy(ticket => {
    ticket.deleted_at = new Date();
    ticket.is_active = false;
});

module.exports = UserFeedLike;
