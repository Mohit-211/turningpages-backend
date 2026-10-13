const { Sequelize, DataTypes, Model, ENUM } = require('sequelize');
const sequelize = require('../config/central.db');
const { otpTypes } = require('../config/types');
const config = require('../config/config');

class OTP extends Model { }
OTP.init({
    id: {
        type: DataTypes.INTEGER,
        autoIncrement: true,
        primaryKey: true
    },
    user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    role_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    mobile: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    code: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    type: {
        type: ENUM,
        values: [ otpTypes.EMAIL_VERIFICATION, otpTypes.FORGOT_PASSWORD, otpTypes.MOBILE_VERIFICATION, otpTypes.RESET_PASSWORD ],
        allowNull: false,
        defaultValue: otpTypes.EMAIL_VERIFICATION
    },
    otp_expiration_time: {
        type: DataTypes.DATE,
        allowNull: false
    },
    attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    is_verified: {
        type: DataTypes.BOOLEAN,
        defaultValue: false
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
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
}, {
    sequelize,
    tableName: 'otps',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

// Set the expiry once, at creation; later saves (attempt counts, verification) must not extend it
OTP.beforeValidate(async (OTP) => {
    if (!OTP.otp_expiration_time) {
        OTP.otp_expiration_time = new Date(Date.now() + config.otp.expirationMinutes * 60 * 1000);
    }
});

OTP.beforeUpdate(async (OTP) => {
    OTP.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});
OTP.beforeDestroy(async (OTP) => {
    OTP.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    OTP.is_active = false;
});

module.exports = OTP;
