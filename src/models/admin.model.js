const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Admin extends Model { }
Admin.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    role_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    department_id: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    name: {
        type: DataTypes.STRING(200),
        allowNull: true
    },
    email: {
        type: DataTypes.STRING(100),
        allowNull: false
    },
    password: {
        type: DataTypes.STRING,
        allowNull: true
    },
    socket_id: {
        type: DataTypes.STRING(150),
        allowNull: true
    },
    remember_token: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    otp: {
        type: DataTypes.STRING,
        allowNull: true,
        set(value) {
            if (!value) {
                this.setDataValue('is_otp_valid', false);
            } else {
                this.setDataValue('is_otp_valid', true);
            }
            this.setDataValue('otp', value);
        },
    },
    is_otp_valid: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    otp_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    otp_attempts: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0,
    },
    reset_token_expires_at: {
        type: DataTypes.DATE,
        allowNull: true,
    },
    password_changed_at: {
        type: DataTypes.DATE,
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
    updated_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    updated_at: {
        type: DataTypes.DATE,
        defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
        onUpdate: Sequelize.literal('CURRENT_TIMESTAMP'),
    },
    deleted_by: {
        type: DataTypes.INTEGER,
        allowNull: true
    },
    deleted_at: {
        type: DataTypes.DATE,
        allowNull: true,
    }
}, {
    sequelize,
    tableName: 'admins',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

Admin.afterCreate(async (admin, options) => {
    const socketId = `${admin.role_id}-${admin.id}-${admin.department_id}-socketId`;
    admin.socket_id = socketId;
    // Reuse the caller's transaction so the save does not wait on the INSERT's row lock
    await admin.save({ transaction: options.transaction });
});

Admin.isEmailTaken = async function (email) {
    let u = await this.findOne({ where: { email: email, is_active: true } })
    return !!u
};

Admin.beforeUpdate(async (admin) => {
    admin.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Admin.beforeDestroy(async (admin) => {
    admin.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    admin.is_active = false;
});

module.exports = Admin;