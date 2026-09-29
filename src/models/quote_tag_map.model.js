const { Sequelize, DataTypes, Model } = require('sequelize');
const sequelize = require('../config/central.db');

class QuoteTagMap extends Model { };
QuoteTagMap.init(
    {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        quote_id: {
            type: DataTypes.BIGINT.UNSIGNED,
            allowNull: false,
        },
        tag_id: {
            type: DataTypes.INTEGER,
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
        tableName: 'quote_tag_map',
        timestamps: true,
        underscored: true,
        paranoid: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        deletedAt: 'deleted_at',
    }
);


QuoteTagMap.beforeUpdate((genre) => {
    genre.updated_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
});

QuoteTagMap.beforeDestroy((genre) => {
    genre.deleted_at = new Date().toISOString().replace(/T/, ' ').replace(/\..+/g, '');
    genre.is_active = false;
});

module.exports = QuoteTagMap;
