const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Book extends Model { };
Book.init(
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
            type: DataTypes.STRING(200),
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('draft', 'completed', 'in-editing','feedback'),
            defaultValue: 'draft',
        },
        visibility: {
            type: DataTypes.ENUM('public', 'private', 'restricted'),
            defaultValue: 'public',
        },
        author: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        isbn: {
            type: DataTypes.STRING(20),
            allowNull: true,
            unique: true,
        },
        word_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        tags: {
            type: DataTypes.JSON,
            allowNull: true,
        },
        language: {
            type: DataTypes.STRING(50),
            allowNull: true,
            defaultValue: 'English',
        },

        editor_notes: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        editor_submission_file_name: {
            type: DataTypes.STRING(150),
            allowNull: true,
        },
        editor_submission_file_type: {
            type: DataTypes.STRING(150),
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



        cover_img_name: {
            type: DataTypes.STRING,
            allowNull: true
        },
        cover_img_uri: {
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
        tableName: 'books',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


Book.beforeUpdate((Book) => {
    Book.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Book.beforeDestroy((Book) => {
    Book.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Book.is_active = false;
});

module.exports = Book;
