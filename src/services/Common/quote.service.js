/** @format */

const { Op } = require("sequelize");
const httpStatus = require("http-status");
const { Quote, QuoteTag } = require("../../models");
const ApiError = require("../../utils/ApiError");

const createQuote = async (body) => {
	try {
		const { author, quote, desc, tags, add_type, quotes } = body;

		console.log("QUOTES INPUT:", quotes);

		// ✅ VALIDATE TYPE
		if (!add_type || !["single", "multiple"].includes(add_type)) {
			throw new ApiError(
				httpStatus.BAD_REQUEST,
				"add_type must be either 'single' or 'multiple'"
			);
		}

		// =====================================================
		// 🔹 SINGLE QUOTE
		// =====================================================
		if (add_type === "single") {
			if (!quote?.trim()) {
				throw new ApiError(httpStatus.BAD_REQUEST, "Quote text required");
			}

			const newQuote = await Quote.create({
				author: author?.trim(),
				quote: quote.trim(),
				desc,
				character_count: quote.trim().length,
			});

			// ✅ handle tags (IDs)
			if (tags && tags.length) {
				await newQuote.setQuoteTags(tags);
			}

			return newQuote;
		}

		// =====================================================
		// 🔹 MULTIPLE QUOTES (CSV)
		// =====================================================
		if (add_type === "multiple") {
			if (!Array.isArray(quotes) || quotes.length === 0) {
				throw new ApiError(
					httpStatus.BAD_REQUEST,
					"quotes array is required for multiple add_type"
				);
			}

			// ✅ STEP 1: VALIDATE + FORMAT
			const formattedQuotes = quotes.map((q) => {
				if (!q.quote?.trim()) {
					throw new ApiError(
						httpStatus.BAD_REQUEST,
						"Each quote must have quote text"
					);
				}

				return {
					author: q.author?.trim() || author,
					quote: q.quote.trim(),
					desc: q.desc?.trim() || desc,
					character_count: q.quote.trim().length,
				};
			});

			// ✅ STEP 2: BULK INSERT
			const createdQuotes = await Quote.bulkCreate(formattedQuotes, {
				returning: true,
				ignoreDuplicates: true, 
			});

			// =====================================================
			// 🔥 STEP 3: HANDLE TAGS (SAFE VERSION)
			// =====================================================

			// Get all existing tags
			const existingTags = await QuoteTag.findAll();
			const tagMap = {};

			existingTags.forEach((tag) => {
				tagMap[tag.title.toLowerCase()] = tag.id;
			});

			await Promise.all(
				createdQuotes.map(async (quoteInstance, index) => {
					try {
						let rowTags = quotes[index]?.tags || [];

						// ✅ normalize string → array
						if (typeof rowTags === "string") {
							rowTags = rowTags.split("|").map((t) => t.trim());
						}

						// ✅ ensure array
						if (!Array.isArray(rowTags)) rowTags = [];

						// fallback global tags
						if ((!rowTags.length || !rowTags) && tags?.length) {
							await quoteInstance.setQuoteTags(tags);
							return;
						}

						if (!rowTags.length) return;

						const tagIds = [];

						for (const tagName of rowTags) {
							if (!tagName) continue;

							const cleanName = String(tagName).trim();
							if (!cleanName) continue;

							const key = cleanName.toLowerCase();

							let tagId = tagMap[key];

							if (!tagId) {
								const [tag] = await QuoteTag.findOrCreate({
									where: { title: cleanName },
								});

								tagId = tag.id;
								tagMap[key] = tagId;
							}

							if (tagId) {
								tagIds.push(tagId);
							}
						}

						// ✅ remove duplicates + invalid
						const uniqueTagIds = [...new Set(tagIds.filter(Boolean))];

						if (uniqueTagIds.length > 0) {
							await quoteInstance.setQuoteTags(uniqueTagIds);
						}
					} catch (err) {
						console.error("TAG PROCESS ERROR:", err);
					}
				})
			);

			return createdQuotes;
		}
	} catch (error) {
	console.error("FULL ERROR:", error);
	console.error("STACK:", error.stack);

	throw new ApiError(
		error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
		error.message
	);
}
};

const updateQuote = async (quote_id, body) => {
	try {
		const quote = await Quote.findByPk(quote_id);

		if (!quote) {
			throw new ApiError(httpStatus.NOT_FOUND, "Quote not found");
		}

		await quote.update({
			author: body.author ?? quote.author,
			quote: body.quote ?? quote.quote,
			desc: body.desc ?? quote.desc,
			character_count: body.quote ? body.quote.length : quote.character_count,
		});

		if (body.tags) {
			await quote.setQuoteTags(body.tags);
		}

		return quote;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const deleteQuote = async (quote_id) => {
	try {
		const quote = await Quote.findByPk(quote_id);

		if (!quote) {
			throw new ApiError(httpStatus.NOT_FOUND, "Quote not found");
		}

		await quote.destroy();
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const getQuotes = async (query) => {
	try {
		const page = Number(query.page) || 1;
		const limit = Number(query.limit) || 10;
		const offset = (page - 1) * limit;

		const where = { is_active: true };

		if (query.search) {
			where[Op.or] = [
				{ quote: { [Op.like]: `%${query.search}%` } },
				{ author: { [Op.like]: `%${query.search}%` } },
			];
		}

		const include = [QuoteTag];

		if (query.tag) {
			include.push({
				model: QuoteTag,
				where: { slug: query.tag },
			});
		}

		const { count, rows } = await Quote.findAndCountAll({
			where,
			include,
			limit,
			offset,
			distinct: true,
		});

		return {
			total: count,
			page,
			limit,
			data: rows,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const getQuoteById = async (quote_id) => {
	try {
		const quote = await Quote.findByPk(quote_id, {
			include: [QuoteTag],
		});

		if (!quote) {
			throw new ApiError(httpStatus.NOT_FOUND, "Quote not found");
		}

		return quote;
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const getQuotesByTag = async (slug, query) => {
	try {
		const page = Number(query.page) || 1;
		const limit = Number(query.limit) || 10;
		const offset = (page - 1) * limit;

		const { count, rows } = await Quote.findAndCountAll({
			include: [
				{
					model: QuoteTag,
					where: { slug },
				},
			],
			limit,
			offset,
			distinct: true,
		});

		return {
			total: count,
			page,
			limit,
			data: rows,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const incrementReqCount = async (quote_id) => {
	await Quote.increment("req_count", { where: { id: quote_id } });
};

const getAllTags = async (query) => {
	try {
		const page = Number(query.page) || 1;
		const limit = Number(query.limit) || 20;
		const offset = (page - 1) * limit;

		const where = {};

		if (query.search) {
			where.title = {
				[Op.like]: `%${query.search}%`,
			};
		}

		const { count, rows } = await QuoteTag.findAndCountAll({
			where,
			include: [
				{
					model: Quote,
					attributes: [], // don't return quote data
					through: { attributes: [] },
				},
			],
			attributes: {
				include: [
					[
						require("sequelize").fn(
							"COUNT",
							require("sequelize").col("Quotes.id"),
						),
						"quote_count",
					],
				],
			},
			group: ["QuoteTag.id"],
			limit,
			offset,
			order: [["title", "ASC"]],
			subQuery: false,
		});

		return {
			total: count.length, // because group returns array
			page,
			limit,
			data: rows,
		};
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const createTag = async (body) => {
	try {
		const { title } = body;

		const newTag = await QuoteTag.create({
			title,
		});

		return newTag;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const updateTag = async (id, body) => {
	try {
		const tag = await QuoteTag.findByPk(id);

		if (!tag) {
			throw new ApiError(httpStatus.NOT_FOUND, "Tag not found");
		}

		const { title } = body;

		await tag.update({
			title: title ?? tag.title,
		});

		return tag;
	} catch (error) {
		throw new ApiError(
			error.statusCode || httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

const deleteTag = async (id) => {
	try {
		const quote = await QuoteTag.findByPk(id);

		if (!quote) {
			throw new ApiError(httpStatus.NOT_FOUND, "Tag not found");
		}

		await quote.destroy();
	} catch (error) {
		throw new ApiError(
			error.statusCode ? error.statusCode : httpStatus.INTERNAL_SERVER_ERROR,
			error.message,
		);
	}
};

module.exports = {
	createQuote,
	updateQuote,
	deleteQuote,
	getQuotes,
	getQuoteById,
	getQuotesByTag,
	incrementReqCount,
	getAllTags,
	createTag,
	updateTag,
	deleteTag,
};
