const config = require('./config');

// Stripe price IDs come from .env so staging can use test-mode prices
const STRIPE_PRICE_MAP = config.stripePrices;

const CREDIT_PACKAGES = {
  starter: { credit: 50 },
  author: { credit: 120 },
  pro_author: { credit: 250 },
  studio: { credit: 500 },
};

module.exports = {
  STRIPE_PRICE_MAP,
  CREDIT_PACKAGES,
};
