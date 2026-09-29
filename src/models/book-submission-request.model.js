const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class BookSubmissionRequest extends Model { };

BookSubmissionRequest.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    book_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    status: {
        type: DataTypes.ENUM('pending', 'rejected', 'approved'),
        defaultValue: 'pending',
    },
    event_name: {
        type: DataTypes.ENUM('submit', 're-submit', 'withdraw', 'completed'),
        defaultValue: 'submit',
    },
    submited_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP')
    },
    payment_status: {
        type: DataTypes.ENUM('pending', 'success', 'failed'),
        defaultValue: 'pending',
    },
    reversal_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
     note: {
            type: DataTypes.TEXT,
            allowNull: true,
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
        onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    sequelize,
    tableName: 'book-submission-requests',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
})


BookSubmissionRequest.beforeDestroy(async (attachment) => {
    attachment.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    attachment.is_active = false;
});

module.exports = BookSubmissionRequest;
