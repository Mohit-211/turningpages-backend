const { Sequelize, DataTypes, Model, ENUM } = require('sequelize');
const sequelize = require('../config/central.db');

const chatTypes = {
    ADMIN_USER: 'ADMIN_USER',
    BOOK_GROUP: 'BOOK_GROUP'
};

class ChatRoom extends Model { }

ChatRoom.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    type: {
        type: ENUM,
        values: [chatTypes.ADMIN_USER, chatTypes.BOOK_GROUP],
        allowNull: false
    },
    book_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: true
    },
    created_by: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
    },
    last_message: {
        type: DataTypes.TEXT,
        allowNull: true
    },
    last_message_time: {
        type: DataTypes.DATE,
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
        onUpdate: Sequelize.literal('CURRENT_TIMESTAMP')
    }
}, {
    sequelize,
    tableName: 'chat_rooms',
    timestamps: true,
    underscored: true
});

module.exports = { ChatRoom, chatTypes };