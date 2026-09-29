const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class ConversationMessage extends Model {}

ConversationMessage.init(
	{
		id: {
			type: DataTypes.BIGINT.UNSIGNED,
			autoIncrement: true,
			primaryKey: true,
		},

		conversation_id: {
			type: DataTypes.BIGINT.UNSIGNED,
			allowNull: false,
		},

		role: {
			type: DataTypes.ENUM("system", "user", "assistant"),
			allowNull: false,
		},

		message: {
			type: DataTypes.TEXT("long"),
			allowNull: false,
		},

		is_active: {
			type: DataTypes.BOOLEAN,
			defaultValue: true,
		},

		created_at: {
			type: DataTypes.DATE,
			defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
		},

		updated_at: {
			type: DataTypes.DATE,
			defaultValue: Sequelize.literal("CURRENT_TIMESTAMP"),
			onUpdate: Sequelize.literal("CURRENT_TIMESTAMP"),
		},

		deleted_at: {
			type: DataTypes.DATE,
			allowNull: true,
		},
	},
	{
		sequelize,
		tableName: "conversation_messages",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	},
);

ConversationMessage.beforeUpdate(async (message) => {
	message.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

ConversationMessage.beforeDestroy(async (message) => {
	message.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");

	message.is_active = false;
});

module.exports = ConversationMessage;