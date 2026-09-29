const adminAuthRoute = require('./adminAuth.route');
const adminOpRoute = require('./adminOp.route');
const adminDashboardRoute = require('./dashboard.route');

const adminRoutes = [
    {
        path: '/admin/auth/',
        route: adminAuthRoute,
    },
    {
        path: '/admin/op/',
        route: adminOpRoute,
    },
        {
        path: '/admin/dashboard/',
        route: adminDashboardRoute,
    },
];

module.exports = adminRoutes;