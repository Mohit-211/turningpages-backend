const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class ContactUs extends Model { }

ContactUs.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true
        },
        name: {
            type: DataTypes.STRING(150),
            allowNull: false
        },
        email: {
            type: DataTypes.STRING(150),
            allowNull: false,
            validate: {
                isEmail: true
            }
        },
        subject: {
            type: DataTypes.STRING(255),
            allowNull: false
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: false
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
        },
        created_by: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: true
        }
    },
    {
        sequelize,
        tableName: 'contact_us',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at'
    }
);

// Hooks (same style as your OTP model)
ContactUs.beforeUpdate(async (contact) => {
    contact.updated_at = new Date()
        .toISOString()
        .replace(/T/, ' ')
        .replace(/\..+/g, '');
});

ContactUs.beforeDestroy(async (contact) => {
    contact.deleted_at = new Date()
        .toISOString()
        .replace(/T/, ' ')
        .replace(/\..+/g, '');
    contact.is_active = false;
});

module.exports = ContactUs;
