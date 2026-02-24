import { Router } from "express";
import { userManagementController } from "../controllers/user-management.controller";
import { addUserValidationStore, validate } from "../validations/user-management.validation";
import { authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";

const UserManagementRouter: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin endpoints
 */
/**
 * @swagger
 * /api/admin/management/users:
 *   get:
 *     summary: List admin users
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get("/users", authenticate, userManagementController.getAllUsers);
/**
 * @swagger
 * /api/admin/management/users/{id}:
 *   get:
 *     summary: Get admin user by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Admin user retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
UserManagementRouter.get("/users/:id", authenticate, userManagementController.getUser);
/**
 * @swagger
 * /api/admin/management/users/{id}/activities:
 *   get:
 *     summary: Get admin user activities
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       200:
 *         description: Activities retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get("/users/:id/activities", authenticate, userManagementController.getUserActivities);
/**
 * @swagger
 * /api/admin/management/lookups:
 *   get:
 *     summary: List roles and departments (unpaginated)
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *           enum: [role, department]
 *         description: Return only roles or only departments
 *     responses:
 *       200:
 *         description: Lookups retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get("/lookups", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.getLookups);
/**
 * @swagger
 * /api/admin/management/users/stats:
 *   get:
 *     summary: User counters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User stats retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get("/users/stats", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.getUserStats);
/**
 * @swagger
 * /api/admin/management/profile:
 *   get:
 *     summary: Get current admin profile
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get("/profile", authenticate, userManagementController.getProfile);

/**
 * @swagger
 * /api/admin/management/users:
 *   post:
 *     summary: Create a new admin user
 *     tags: [Admin]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, fullName, role, department]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               fullName:
 *                 type: string
 *               role:
 *                 type: string
 *               department:
 *                 type: string
 *     responses:
 *       200:
 *         description: Admin user created
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
UserManagementRouter.post("/add-user", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.addUser);

//SEARCH AND FILTER


// Role Management
/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin endpoints
 */

/**
 * @swagger
 * /api/admin/management/roles:
 *   post:
 *     summary: Create a role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               permissions:
 *                 type: array
 *                 items:
 *                   type: string
 *     responses:
 *       200:
 *         description: Role created
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.post("/roles", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.createRole);
/**
 * @swagger
 * /api/admin/management/roles:
 *   get:
 *     summary: List roles
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get("/roles", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.getRoles);
/**
 * @swagger
 * /api/admin/management/roles/stats:
 *   get:
 *     summary: Role counters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role stats retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get("/roles/stats", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.getRoleStats);
/**
 * @swagger
 * /api/admin/management/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
UserManagementRouter.get("/roles/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.getRole);
/**
 * @swagger
 * /api/admin/management/roles/{id}/permissions:
 *   get:
 *     summary: Get role permissions
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: format
 *         schema:
 *           type: string
 *           enum: [flat, grouped]
 *           default: grouped
 *     responses:
 *       200:
 *         description: Role permissions retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
UserManagementRouter.get("/roles/:id/permissions", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.getRolePermissions);
/**
 * @swagger
 * /api/admin/management/roles/{id}:
 *   put:
 *     summary: Update a role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Role updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.put("/roles/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.updateRole);
/**
 * @swagger
 * /api/admin/management/roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Role deleted
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.delete("/roles/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.deleteRole);

// Department Management
/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin endpoints
 */
/**
 * @swagger
 * /api/admin/management/departments:
 *   post:
 *     summary: Create a department
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *               branch:
 *                 type: string
 *     responses:
 *       200:
 *         description: Department created
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.post("/departments", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.createDepartment);
/**
 * @swagger
 * /api/admin/management/departments:
 *   get:
 *     summary: List departments
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *     responses:
 *       200:
 *         description: Departments retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get("/departments", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.getDepartments);
/**
 * @swagger
 * /api/admin/management/departments/stats:
 *   get:
 *     summary: Department counters
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department stats retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get("/departments/stats", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.getDepartmentStats);
/**
 * @swagger
 * /api/admin/management/departments/{id}:
 *   get:
 *     summary: Get department by ID
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
UserManagementRouter.get("/departments/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.getDepartment);
/**
 * @swagger
 * /api/admin/management/departments/{id}:
 *   put:
 *     summary: Update a department
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *     responses:
 *       200:
 *         description: Department updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.put("/departments/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.updateDepartment);

/**
 * @swagger
 * /api/admin/management/departments/{id}:
 *   delete:
 *     summary: Delete a department
 *     tags: [Admin]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Department deleted
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.delete("/departments/:id", authenticate, authorize(UserRole.SUPER_ADMIN, UserRole.ADMIN), userManagementController.deleteDepartment);

export default UserManagementRouter
