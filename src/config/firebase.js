const { initializeApp, cert } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const config = require("./config");

const app = initializeApp({
  credential: cert(config.firebase),
});

module.exports = { firestore: getFirestore(app) };
