const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Chapter extends Model { };

Chapter.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    book_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    title: {
        type: DataTypes.STRING,
        allowNull: true
    },
    description: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    content: {
        type: DataTypes.TEXT,
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
    word_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue: 0
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
    tableName: 'chapters',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
})

Chapter.beforeUpdate(async (attachment) => {
    attachment.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Chapter.beforeDestroy(async (attachment) => {
    attachment.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    attachment.is_active = false;
});

module.exports = Chapter;
