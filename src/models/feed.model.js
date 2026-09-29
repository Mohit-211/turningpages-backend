const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Feed extends Model { };
Feed.init(
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
        genre_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        title: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        visibility: {
            type: DataTypes.ENUM('public', 'private', 'restricted'),
            defaultValue: 'public',
        },
        tags: {
            type: DataTypes.JSON,
            allowNull: true,
        },

        likes_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        comment_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        views_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        shares_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },
        rating_avg: {
            type: DataTypes.DECIMAL(3, 2),
            defaultValue: 0.00,
        },
        rating_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
        },

        img_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        img_uri: {
            type: DataTypes.STRING,
            defaultValue: '/images'
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
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
    },
    {
        sequelize,
        tableName: 'feeds',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


Feed.beforeUpdate((Feed) => {
    Feed.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Feed.beforeDestroy((Feed) => {
    Feed.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Feed.is_active = false;
});

module.exports = Feed;
