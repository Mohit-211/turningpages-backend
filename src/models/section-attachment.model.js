const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class SectionAttachment extends Model { };

SectionAttachment.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    section_id: {
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
    file_size: {
        type: DataTypes.STRING,
        allowNull: true
    },
    likes_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue : 0
    },
    comment_count: {
        type: DataTypes.INTEGER,
        allowNull: true,
        defaultValue : 0
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
    tableName: 'section_attachments',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
})

SectionAttachment.beforeUpdate(async (attachment) => {
    attachment.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

SectionAttachment.beforeDestroy(async (attachment) => {
    attachment.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    attachment.is_active = false;
});

module.exports = SectionAttachment;
