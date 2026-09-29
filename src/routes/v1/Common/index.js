const languageRoute = require("./language.route");
const roleRoute = require("./role.route");
const departmentRoute = require("./department.route");
const genreRoute = require("./genre.route");
const bookRoute = require("./book.route");
const chapterRoute = require("./chapter.route");
const paymentRoute = require("./payment.route");
const supportRoute = require("./support.route");
const feedRoute = require("./feed.route");
const quotesRoute = require("./quote.route");
const chatRoute = require("./chat.route");
const tavRoute = require("./tav.route");


const commonRoutes = [
	{
		path: "/role",
		route: roleRoute,
	},
	{
		path: "/department",
		route: departmentRoute,
	},
	{
		path: "/language",
		route: languageRoute,
	},
	{
		path: "/genres",
		route: genreRoute,
	},
	{
		path: "/books",
		route: bookRoute,
	},
	{
		path: "/chapters",
		route: chapterRoute,
	},
	{
		path: "/payments",
		route: paymentRoute,
	},
	{
		path: "/support",
		route: supportRoute,
	},
	{
		path: "/feeds",
		route: feedRoute,
	},
	{
		path: "/quotes",
		route: quotesRoute,
	},
	{
		path: "/chats",
		route: chatRoute,
	},
	{
		path: "/tav",
		route: tavRoute,
	},
];

module.exports = commonRoutes;
