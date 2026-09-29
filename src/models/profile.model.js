const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Profile extends Model { }
Profile.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
    },
    user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    email: {
        type: DataTypes.STRING(),
        allowNull: true
    },
    name: {
        type: DataTypes.STRING(),
        allowNull: true
    },
    last_name: {
        type: DataTypes.STRING(),
        allowNull: true
    },
    mobile: {
        type: DataTypes.STRING(50),
        allowNull: true
    },
    overall_ratings: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    no_of_user_rated: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    no_of_user_reviewed: {
        type: DataTypes.INTEGER,
        allowNull: false,
        defaultValue: 0
    },
    is_active: {
        type: DataTypes.BOOLEAN,
        defaultValue: true
    },
    created_by: {
        type: DataTypes.INTEGER,
        allowNull: true,
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
    tableName: 'profiles',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
});

Profile.beforeUpdate(async (profile) => {
    profile.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Profile.beforeDestroy(async (profile) => {
    profile.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    profile.is_active = false;
});

module.exports = Profile;
