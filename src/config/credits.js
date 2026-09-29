const STRIPE_PRICE_MAP = {
  starter: "price_1TMqizJqKMpaxSGy0uKgAgpy",
  author: "price_1TMqjwJqKMpaxSGy8CEsj8ZV",
  pro_author: "price_1TMqklJqKMpaxSGyBUzvI2CP",
  studio: "price_1TMqlmJqKMpaxSGyCKQnCtKw",
};

// TODO: our test key
// const STRIPE_PRICE_MAP = {
//   starter: "price_1THilLPAPHDAfE5AJYRiQSru",
//   author: "price_1THioUPAPHDAfE5AmcMlGGka",
//   pro_author: "price_1THip8PAPHDAfE5AZGYQZTMa",
//   studio: "price_1THipgPAPHDAfE5AVrsej07X",
// };

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
