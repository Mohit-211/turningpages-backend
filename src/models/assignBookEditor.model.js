const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class AssignBookEditor extends Model { };
AssignBookEditor.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        book_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        editor_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        assigned_by: {
            type: DataTypes.BIGINT.UNSIGNED,
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
        tableName: 'assign_book_editors',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


AssignBookEditor.beforeUpdate((genre) => {
    genre.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

AssignBookEditor.beforeDestroy((genre) => {
    genre.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    genre.is_active = false;
});

module.exports = AssignBookEditor;
