const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');
const slugify = require('slugify');

class QuoteTag extends Model { };
QuoteTag.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        slug: {
            type: DataTypes.STRING(200),
            allowNull: false,
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
        tableName: 'quote_tag',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);

QuoteTag.beforeValidate((tag) => {
    if (tag.title) {
        tag.slug = slugify(tag.title, {
            lower: true,
            strict: true,
            trim: true
        });
    }
});

QuoteTag.beforeUpdate((genre) => {
    genre.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

QuoteTag.beforeDestroy((genre) => {
    genre.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    genre.is_active = false;
});

module.exports = QuoteTag;
