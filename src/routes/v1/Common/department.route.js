const express = require('express');
const router = express.Router();

const { departmentController } = require('../../../controllers');
const { adminAuthMiddleware } = require('../../../middlewares');

const anyAdmin = [adminAuthMiddleware.validateJWTtoken];
const superAdmin = [adminAuthMiddleware.validateJWTtoken, adminAuthMiddleware.isSuperAdmin];

router.post('/', superAdmin, departmentController.createDepartment);
router.get('/', anyAdmin, departmentController.getAllDeparments);
router.get('/:id', anyAdmin, departmentController.findDepartmentById);
router.put('/:id', superAdmin, departmentController.updateDepartment);
router.delete('/:id', superAdmin, departmentController.deleteDepartment);

module.exports = router;