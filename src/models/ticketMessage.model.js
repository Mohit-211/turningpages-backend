const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class TicketMessage extends Model { }

TicketMessage.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },

    ticket_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
    },

    sender_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
    },

    sender_role: {
        type: DataTypes.ENUM('user', 'support', 'admin'),
        allowNull: false
    },

    message: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    is_internal: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
        comment: 'Internal notes visible only to support/admin'
    },

    created_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    }

}, {
    sequelize,
    tableName: 'ticket_messages',
    timestamps: false,
    underscored: true
});

module.exports = TicketMessage;
