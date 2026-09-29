const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class ChapterAttachment extends Model { };

ChapterAttachment.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    chapter_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    caption: {
        type: DataTypes.STRING,
        allowNull: true
    },
    file_type: {
        type: DataTypes.STRING,
        allowNull: true
    },
    file_name: {
        type: DataTypes.STRING,
        allowNull: true
    },
    file_uri: {
        type: DataTypes.STRING,
        allowNull: true
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
    tableName: 'chapter_attachments',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
})

ChapterAttachment.beforeUpdate(async (attachment) => {
    attachment.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

ChapterAttachment.beforeDestroy(async (attachment) => {
    attachment.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    attachment.is_active = false;
});

module.exports = ChapterAttachment;
