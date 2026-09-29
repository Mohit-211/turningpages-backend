const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Section extends Model { };

Section.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    book_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false,
    },
    chapter_id: {
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
    tableName: 'sections',
    timestamps: true,
    underscored: true,
    paranoid: true,
    createdAt: 'created_at',
    updatedAt: 'updated_at',
    deletedAt: 'deleted_at'
})

Section.beforeUpdate(async (userAttachment) => {
    userAttachment.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Section.beforeDestroy(async (userAttachment) => {
    userAttachment.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    userAttachment.is_active = false;
});

module.exports = Section;
