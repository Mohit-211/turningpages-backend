const express = require('express');
const router = express.Router();

const {roleController} = require('../../../controllers');
const { adminAuthMiddleware } = require('../../../middlewares');

const anyAdmin = [adminAuthMiddleware.validateJWTtoken];
const superAdmin = [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin];

router.post('/', superAdmin, roleController.createRole);
router.get('/:id', anyAdmin, roleController.findRoleById);
router.get('/', anyAdmin, roleController.getAllRoles);
router.put('/:id', superAdmin, roleController.updateRole);
router.delete('/:id', superAdmin, roleController.deleteRole);

module.exports = router;