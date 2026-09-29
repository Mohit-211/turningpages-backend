const { Sequelize, DataTypes, Model } = require("sequelize");
const sequelize = require("../config/central.db");

class Conversation extends Model {}

Conversation.init(
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

		title: {
			type: DataTypes.STRING,
			allowNull: true,
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
		tableName: "conversations",
		timestamps: true,
		underscored: true,
		paranoid: true,
		createdAt: "created_at",
		updatedAt: "updated_at",
		deletedAt: "deleted_at",
	},
);

Conversation.beforeUpdate(async (conversation) => {
	conversation.updated_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");
});

Conversation.beforeDestroy(async (conversation) => {
	conversation.deleted_at = new Date()
		.toISOString()
		.replace(/T/, " ")
		.replace(/\..+/g, "");

	conversation.is_active = false;
});

module.exports = Conversation;