const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Ticket extends Model { }

Ticket.init({
    id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true
    },

    ticket_code: {
        type: DataTypes.STRING(30),
        unique: true,
        allowNull: false
    },

    user_id: {
        type: DataTypes.BIGINT,
        allowNull: false,
        comment: 'User who created the ticket'
    },

    assigned_to: {
        type: DataTypes.BIGINT,
        allowNull: true,
        comment: 'Support agent/admin user id'
    },

    subject: {
        type: DataTypes.STRING(255),
        allowNull: false
    },

    description: {
        type: DataTypes.TEXT,
        allowNull: false
    },

    priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium'
    },

    status: {
        type: DataTypes.ENUM(
            'open',
            'in_progress',
            'waiting_user',
            'resolved',
            'closed'
        ),
        defaultValue: 'open'
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
    tableName: 'tickets',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

Ticket.beforeUpdate(ticket => {
    ticket.updated_at = new Date();
});

Ticket.beforeDestroy(ticket => {
    ticket.deleted_at = new Date();
    ticket.is_active = false;
});

module.exports = Ticket;
