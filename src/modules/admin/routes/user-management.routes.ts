import { Router } from "express";
import { userManagementController } from "../controllers/user-management.controller";
import { authenticate, requirePermission } from "../../../shared/middleware";
import { addUserValidationStore, validate } from "../validations/user-management.validation";

const UserManagementRouter: Router = Router();

/**
 * @swagger
 * tags:
 *   name: Admin
 *   description: Admin endpoints
 */

/**
 * @swagger
 * /api/admin/management/users/stats:
 *   get:
 *     summary: User counters
 *     tags: [admin-user-management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: User stats retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/users/stats",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "USERS", action: "view" }),
  userManagementController.getUserStats
);

/**
 * @swagger
 * /api/admin/management/users:
 *   get:
 *     summary: List admin users
 *     tags: [admin-user-management]
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
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Keyword search across name, email and phone number
 *       - in: query
 *         name: fullName
 *         schema:
 *           type: string
 *         description: Search by full name
 *       - in: query
 *         name: email
 *         schema:
 *           type: string
 *         description: Search by email
 *       - in: query
 *         name: department
 *         schema:
 *           type: string
 *         description: Filter by department name or ID
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *         description: Filter by role name or ID
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *         description: Filter by status (Active, Deactivated, or generic boolean true/false)
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [active, pending, deactivated]
 *         description: Filter by user status
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/users",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "USERS", action: "view" }),
  userManagementController.getAllUsers
);

/**
 * @swagger
 * /api/admin/management/users/all:
 *   get:
 *     summary: List all admin users without pagination
 *     tags: [admin-user-management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Filter by full name, email, or phone number
 *     responses:
 *       200:
 *         description: Admin users retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/users/all",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "USERS", action: "view" }),
  userManagementController.listAllUsers
);

/**
 * @swagger
 * /api/admin/management/users/export:
 *   get:
 *     summary: Export admin users as CSV
 *     tags: [admin-user-management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/users/export",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "USERS", action: "export" }),
  userManagementController.exportUsersCsv
);

/**
 * @swagger
 * /api/admin/management/users/{id}:
 *   get:
 *     summary: Get admin user by ID
 *     tags: [admin-user-management]
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
UserManagementRouter.get(
  "/users/:id",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "USERS", action: "view" }),
  userManagementController.getUser
);

/**
 * @swagger
 * /api/admin/management/users/{id}/activities:
 *   get:
 *     summary: Get admin user activities
 *     tags: [admin-user-management]
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
UserManagementRouter.get(
  "/users/:id/activities",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "USERS", action: "view" }),
  userManagementController.getUserActivities
);

/**
 * @swagger
 * /api/admin/management/users/{id}/activities/export:
 *   get:
 *     summary: Export admin user activities as CSV
 *     tags: [admin-user-management]
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
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/users/:id/activities/export",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "USERS", action: "export" }),
  userManagementController.exportUserActivitiesCsv
);

/**
 * @swagger
 * /api/admin/management/roles/export:
 *   get:
 *     summary: Export roles as CSV
 *     tags: [admin-user-management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/roles/export",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "ROLES", action: "export" }),
  userManagementController.exportRolesCsv
);

/**
 * @swagger
 * /api/admin/management/departments/export:
 *   get:
 *     summary: Export departments as CSV
 *     tags: [admin-user-management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: CSV file
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/departments/export",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "DEPARTMENTS", action: "export" }),
  userManagementController.exportDepartmentsCsv
);

/**
 * @swagger
 * /api/admin/management/lookups:
 *   get:
 *     summary: List roles, branches and departments (unpaginated)
 *     tags: [admin-user-management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: query
 *         schema:
 *           type: string
 *           enum: [role, department, branch]
 *         description: Return only roles, departments, or branches
 *     responses:
 *       200:
 *         description: Lookups retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/lookups",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "MODULE", action: "view" }),
  userManagementController.getLookups
);

/**
 * @swagger
 * /api/admin/management/profile:
 *   get:
 *     summary: Get current admin profile
 *     tags: [admin-user-management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Profile retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/profile",
  authenticate,
  userManagementController.getProfile
);

/**
 * @swagger
 * /api/admin/management/add-user:
 *   post:
 *     summary: Create a new admin user
 *     tags: [admin-user-management]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, fullName, phoneNumber, department, branch, role]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *                 example: +2348012345678
 *                 pattern: '^\\+234\\d{10}$'
 *               role:
 *                 type: string
 *               department:
 *                 type: string
 *               branch:
 *                 type: string
 *               position:
 *                 type: string
 *                 nullable: true
 *               altPhoneNumber:
 *                 type: string
 *                 nullable: true
 *                 example: +2348012345678
 *                 pattern: '^\\+234\\d{10}$'
 *     responses:
 *       200:
 *         description: Admin user created
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 */
UserManagementRouter.post(
  "/add-user",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "USERS", action: "create" }),
  addUserValidationStore,
  validate,
  userManagementController.addUser
);

/**
 * @swagger
 * /api/admin/management/users/{id}/status:
 *   patch:
 *     summary: Toggle admin user active status
 *     tags: [admin-user-management]
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
 *             required: [isActive]
 *             properties:
 *               isActive:
 *                 type: boolean
 *               reason:
 *                 type: string
 *                 nullable: true
 *     responses:
 *       200:
 *         description: Admin user status updated
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
UserManagementRouter.patch(
  "/users/:id/status",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "USERS", action: "edit" }),
  userManagementController.toggleUserActive
);

/**
 * @swagger
 * /api/admin/management/users/{id}:
 *   patch:
 *     summary: Update an admin user
 *     tags: [admin-user-management]
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
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               fullName:
 *                 type: string
 *               phoneNumber:
 *                 type: string
 *               role:
 *                 type: string
 *               department:
 *                 type: string
 *               branch:
 *                 type: string
 *               position:
 *                 type: string
 *               altPhoneNumber:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Admin user updated
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
UserManagementRouter.patch(
  "/users/:id",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "USERS", action: "edit" }),
  userManagementController.updateUser
);

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
 *     tags: [admin-user-management]
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
 *               description:
 *                 type: string
 *               branch:
 *                 type: string
 *               department:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *               permissions:
 *                 oneOf:
 *                   - type: object
 *                     additionalProperties:
 *                       type: object
 *                       additionalProperties:
 *                         type: array
 *                         items:
 *                           type: string
 *                           enum: [can.view, can.edit, can.create, can.delete, can.export, view, edit, create, delete, export]
 *                   - type: array
 *                     items:
 *                       type: string
 *                       example: "TRANSACTIONS - MODULE - can.view"
 *           examples:
 *             groupedPermissions:
 *               summary: Grouped permissions object (recommended)
 *               value:
 *                 name: "Operations Manager"
 *                 description: "Ops role with broad access"
 *                 branch: "Head Office"
 *                 department: "Operations"
 *                 isDefault: false
 *                 permissions:
 *                   TRANSACTIONS:
 *                     MODULE: ["can.view", "can.edit", "can.create", "can.delete"]
 *                   CUSTOMERS:
 *                     MODULE: ["can.view", "can.edit"]
 *                   AGENTS:
 *                     MODULE: ["can.view", "can.create", "can.edit"]
 *                   SETTLEMENTS:
 *                     MODULE: ["can.view", "can.edit"]
 *                   RATES:
 *                     MODULE: ["can.view", "can.edit", "can.create"]
 *                   USER_MANAGEMENT:
 *                     ROLES: ["can.view", "can.create", "can.edit", "can.delete"]
 *                     USERS: ["can.view", "can.create", "can.edit"]
 *                   WORKFLOW:
 *                     MODULE: ["can.view", "can.edit"]
 *                   COMPLIANCE:
 *                     MODULE: ["can.view", "can.edit"]
 *                   REPORTS:
 *                     MODULE: ["can.view", "can.create"]
 *                   AUDIT:
 *                     MODULE: ["can.view"]
 *             flattenedPermissions:
 *               summary: Flattened array format
 *               value:
 *                 name: "Operations Manager"
 *                 description: "Ops role with broad access"
 *                 branch: "Head Office"
 *                 department: "Operations"
 *                 isDefault: false
 *                 permissions:
 *                   - "TRANSACTIONS - MODULE - can.view"
 *                   - "TRANSACTIONS - MODULE - can.edit"
 *                   - "TRANSACTIONS - MODULE - can.create"
 *                   - "TRANSACTIONS - MODULE - can.delete"
 *     responses:
 *       200:
 *         description: Role created
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.post(
  "/roles",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "ROLES", action: "create" }),
  userManagementController.createRole
);

/**
 * @swagger
 * /api/admin/management/roles:
 *   get:
 *     summary: List roles
 *     tags: [admin-user-management]
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
 *           type: string
 *         description: Filter by status (Active, Deactivated, or generic boolean true/false)
 *     responses:
 *       200:
 *         description: Roles retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/roles",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "ROLES", action: "view" }),
  userManagementController.getRoles
);

/**
 * @swagger
 * /api/admin/management/roles/stats:
 *   get:
 *     summary: Role counters
 *     tags: [admin-user-management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Role stats retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/roles/stats",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "ROLES", action: "view" }),
  userManagementController.getRoleStats
);

/**
 * @swagger
 * /api/admin/management/roles/{id}:
 *   get:
 *     summary: Get role by ID
 *     tags: [admin-user-management]
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
UserManagementRouter.get(
  "/roles/:id",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "ROLES", action: "view" }),
  userManagementController.getRole
);

/**
 * @swagger
 * /api/admin/management/roles/{id}/permissions:
 *   get:
 *     summary: Get role permissions
 *     tags: [admin-user-management]
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
UserManagementRouter.get(
  "/roles/:id/permissions",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "ROLES", action: "view" }),
  userManagementController.getRolePermissions
);

/**
 * @swagger
 * /api/admin/management/roles/{id}/status:
 *   patch:
 *     summary: Toggle role active status
 *     tags: [admin-user-management]
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
 *             required: [isActive]
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Role status updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
UserManagementRouter.patch(
  "/roles/:id/status",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "ROLES", action: "edit" }),
  userManagementController.toggleRoleActive
);

/**
 * @swagger
 * /api/admin/management/roles/{id}/default:
 *   patch:
 *     summary: Set role as system default
 *     tags: [admin-user-management]
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
 *         description: Role set as default
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
UserManagementRouter.patch(
  "/roles/:id/default",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "ROLES", action: "edit" }),
  userManagementController.setDefaultRole
);

/**
 * @swagger
 * /api/admin/management/permissions:
 *   get:
 *     summary: Get all permissions
 *     description: Returns all system permissions. Supports filters by module, featureKey, action and search term.
 *     tags: [admin-user-management]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Free text search across module, featureKey and action
 *       - in: query
 *         name: module
 *         schema:
 *           type: string
 *         description: Filter by module name (e.g., TRANSACTIONS, USER_MANAGEMENT)
 *       - in: query
 *         name: featureKey
 *         schema:
 *           type: string
 *         description: Filter by feature key (e.g., MODULE, ROLES, USERS)
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *           enum: [view, edit, create, delete, export]
 *         description: Filter by action
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Filter by active state
 *     responses:
 *       200:
 *         description: Permissions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       module:
 *                         type: string
 *                       featureKey:
 *                         type: string
 *                       action:
 *                         type: string
 *                         enum: [view, edit, create, delete, export]
 *                       label:
 *                         type: string
 *                       isActive:
 *                         type: boolean
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *             examples:
 *               default:
 *                 value:
 *                   success: true
 *                   data:
 *                     - id: "perm-1"
 *                       module: "TRANSACTIONS"
 *                       featureKey: "MODULE"
 *                       action: "view"
 *                       label: "MODULE view"
 *                       isActive: true
 *                       createdAt: "2026-03-03T10:00:00.000Z"
 *                       updatedAt: "2026-03-03T10:00:00.000Z"
 *                     - id: "perm-2"
 *                       module: "USER_MANAGEMENT"
 *                       featureKey: "ROLES"
 *                       action: "edit"
 *                       label: "ROLES edit"
 *                       isActive: true
 *                       createdAt: "2026-03-03T10:00:00.000Z"
 *                       updatedAt: "2026-03-03T10:00:00.000Z"
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/permissions",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "ROLES", action: "view" }),
  userManagementController.getPermissions
);

/**
 * @swagger
 * /api/admin/management/modules:
 *   get:
 *     summary: List available permission modules
 *     tags: [admin-user-management]
 *     responses:
 *       200:
 *         description: Modules retrieved successfully
 */
UserManagementRouter.get(
  "/modules",
  userManagementController.getPermissionModules
);

/**
 * @swagger
 * /api/admin/management/roles/{id}:
 *   put:
 *     summary: Update a role
 *     tags: [admin-user-management]
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
 *             properties:
 *               name:
 *                 type: string
 *               description:
 *                 type: string
 *               branch:
 *                 type: string
 *               department:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *               isActive:
 *                 type: boolean
 *               permissions:
 *                 oneOf:
 *                   - type: object
 *                     additionalProperties:
 *                       type: object
 *                       additionalProperties:
 *                         type: array
 *                         items:
 *                           type: string
 *                           enum: [can.view, can.edit, can.create, can.delete, can.export, view, edit, create, delete, export]
 *                   - type: array
 *                     items:
 *                       type: string
 *                       example: "TRANSACTIONS - MODULE - can.view"
 *     responses:
 *       200:
 *         description: Role updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.put(
  "/roles/:id",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "ROLES", action: "edit" }),
  userManagementController.updateRole
);

/**
 * @swagger
 * /api/admin/management/roles/{id}:
 *   delete:
 *     summary: Delete a role
 *     tags: [admin-user-management]
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
UserManagementRouter.delete(
  "/roles/:id",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "ROLES", action: "delete" }),
  userManagementController.deleteRole
);

// Department Management
/**
 * @swagger
 * tags:
 *   name: admin-user-management
 *   description: Admin user management endpoints
 */
/**
 * @swagger
 * /api/admin/management/departments:
 *   post:
 *     summary: Create a department
 *     tags: [admin-user-management]
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
 *               departmentEmail:
 *                 type: string
 *               description:
 *                 type: string
 *               isDefault:
 *                 type: boolean
 *                 description: Mark as default department
 *     responses:
 *       200:
 *         description: Department created
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.post(
  "/departments",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "DEPARTMENTS", action: "create" }),
  userManagementController.createDepartment
);

/**
 * @swagger
 * /api/admin/management/departments:
 *   get:
 *     summary: List departments
 *     tags: [admin-user-management]
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
 *           type: string
 *         description: Filter by status (Active, Deactivated, or generic boolean true/false)
 *     responses:
 *       200:
 *         description: Departments retrieved successfully
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/departments",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "DEPARTMENTS", action: "view" }),
  userManagementController.getDepartments
);

/**
 * @swagger
 * /api/admin/management/departments/stats:
 *   get:
 *     summary: Department counters
 *     tags: [admin-user-management]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Department stats retrieved
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.get(
  "/departments/stats",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "DEPARTMENTS", action: "view" }),
  userManagementController.getDepartmentStats
);

/**
 * @swagger
 * /api/admin/management/departments/{id}/status:
 *   patch:
 *     summary: Toggle department active status
 *     tags: [admin-user-management]
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
 *             required: [isActive]
 *             properties:
 *               isActive:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Department status updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 *       404:
 *         $ref: '#/components/responses/NotFoundError'
 */
UserManagementRouter.patch(
  "/departments/:id/status",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "DEPARTMENTS", action: "edit" }),
  userManagementController.toggleDepartmentActive
);

/**
 * @swagger
 * /api/admin/management/departments/{id}:
 *   get:
 *     summary: Get department by ID
 *     tags: [admin-user-management]
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
UserManagementRouter.get(
  "/departments/:id",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "DEPARTMENTS", action: "view" }),
  userManagementController.getDepartment
);

/**
 * @swagger
 * /api/admin/management/departments/{id}:
 *   put:
 *     summary: Update a department
 *     tags: [admin-user-management]
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
 *             properties:
 *               name: { type: string }
 *               branch: { type: string }
 *               departmentEmail: { type: string }
 *               description: { type: string }
 *               isDefault: { type: boolean }
 *     responses:
 *       200:
 *         description: Department updated
 *       401:
 *         $ref: '#/components/responses/UnauthorizedError'
 */
UserManagementRouter.put(
  "/departments/:id",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "DEPARTMENTS", action: "edit" }),
  userManagementController.updateDepartment
);

/**
 * @swagger
 * /api/admin/management/departments/{id}:
 *   delete:
 *     summary: Delete a department
 *     tags: [admin-user-management]
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
UserManagementRouter.delete(
  "/departments/:id",
  authenticate,
  requirePermission({ module: "USER_MANAGEMENT", feature: "DEPARTMENTS", action: "delete" }),
  userManagementController.deleteDepartment
);

export default UserManagementRouter
