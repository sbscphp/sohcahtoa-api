import { Router } from "express";
import { userManagementController } from "../controllers/user-management.controller";
import { addUserValidationStore, validate } from "../validations/user-management.validation";
import { authRateLimiter, authenticate, authorize } from "../../../shared/middleware";
import { UserRole } from "../../../shared/types";

const UserManagementRouter: Router = Router();


UserManagementRouter.post("/add-user", addUserValidationStore, validate, userManagementController.addUser);
UserManagementRouter.post("/login", authRateLimiter, userManagementController.login);
UserManagementRouter.post("/verify-login", authRateLimiter, userManagementController.verifyLogin);
UserManagementRouter.post("/forgot-password", authRateLimiter, userManagementController.forgotPassword);
UserManagementRouter.post("/reset-password", authRateLimiter, userManagementController.resetPassword);
//SEARCH AND FILTER

UserManagementRouter.get("/users", authenticate, userManagementController.getAllUsers);
UserManagementRouter.get("/profile", authenticate, userManagementController.getProfile);


// Role Management
UserManagementRouter.post("/roles", authenticate, authorize(UserRole.SUPER_ADMIN), userManagementController.createRole);
UserManagementRouter.get("/roles", authenticate, authorize(UserRole.SUPER_ADMIN), userManagementController.getRoles);
UserManagementRouter.get("/roles/:id", authenticate, authorize(UserRole.SUPER_ADMIN), userManagementController.getRole);
UserManagementRouter.put("/roles/:id", authenticate, authorize(UserRole.SUPER_ADMIN), userManagementController.updateRole);
UserManagementRouter.delete("/roles/:id", authenticate, authorize(UserRole.SUPER_ADMIN), userManagementController.deleteRole);

// Department Management
UserManagementRouter.post("/departments", authenticate, authorize(UserRole.SUPER_ADMIN), userManagementController.createDepartment);
UserManagementRouter.get("/departments", authenticate, authorize(UserRole.SUPER_ADMIN), userManagementController.getDepartments);
UserManagementRouter.get("/departments/:id", authenticate, authorize(UserRole.SUPER_ADMIN), userManagementController.getDepartment);
UserManagementRouter.put("/departments/:id", authenticate, authorize(UserRole.SUPER_ADMIN), userManagementController.updateDepartment);
UserManagementRouter.delete("/departments/:id", authenticate, authorize(UserRole.SUPER_ADMIN), userManagementController.deleteDepartment);
export default UserManagementRouter