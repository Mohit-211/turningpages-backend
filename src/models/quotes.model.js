const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class Quote extends Model { };
Quote.init(
    {
        id: {
            type: DataTypes.BIGINT.UNSIGNED,
            autoIncrement: true,
            primaryKey: true,
        },
        author: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        quote: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        desc: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        character_count: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 0
        },
        req_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
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
        tableName: 'quotes',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);




Quote.beforeUpdate((Quote) => {
    Quote.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

Quote.beforeDestroy((Quote) => {
    Quote.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    Quote.is_active = false;
});

module.exports = Quote;
