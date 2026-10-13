const adminAuthMiddleware = require('./adminAuth.middleware');
const userAuthMiddleware = require('./userAuth.middleware');
const anyAuthMiddleware = require('./anyAuth.middleware');


module.exports = {
    adminAuthMiddleware,
    userAuthMiddleware,
    anyAuthMiddleware,
}
