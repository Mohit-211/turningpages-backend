const { Sequelize, DataTypes, Model, ENUM } = require('sequelize');
const sequelize = require('../config/central.db');

const participantRoles = {
    ADMIN: 'ADMIN',
    USER: 'USER',
    EDITOR: 'EDITOR'
};

class ChatParticipant extends Model {}

ChatParticipant.init({
    id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        primaryKey: true
    },
    chat_room_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
    },
    user_id: {
        type: DataTypes.BIGINT.UNSIGNED,
        allowNull: false
    },
    role: {
        type: ENUM,
        values: [participantRoles.ADMIN, participantRoles.USER, participantRoles.EDITOR],
        allowNull: false
    }
}, {
    sequelize,
    tableName: 'chat_participants',
    timestamps: true,
    underscored: true
});

module.exports = { ChatParticipant, participantRoles };