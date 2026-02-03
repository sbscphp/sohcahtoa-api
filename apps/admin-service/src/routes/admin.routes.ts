import { Router } from "express";
import adminController from "../controllers/admin.controller";
import { authorize } from "@fx-platform/shared-middlewares";
import { UserRole } from "@fx-platform/shared-types";

const router: Router = Router();

//Admin Auth Flow

// Dashboard
router.get("/dashboard", adminController.getDashboard);

// Transactions - Buy FX lifecycle (review, approve, reject, settle)
router.post("/transactions/:id/review", adminController.reviewTransaction);
router.post("/transactions/:id/approve", adminController.approveTransaction);
router.post("/transactions/:id/reject", adminController.rejectTransaction);
router.post("/transactions/:id/settle", adminController.settleTransaction);

// Deposits
router.post("/deposits/:transactionId/confirm", adminController.confirmDeposit);

// Admin actions
router.get("/pending-approvals", adminController.getPendingApprovals);
router.get("/actions", adminController.getAdminActions);

// User Management
router.post("/users", authorize(UserRole.SUPER_ADMIN), adminController.createUser);
router.get("/users", authorize(UserRole.SUPER_ADMIN), adminController.getUsers);
router.get("/users/:id", authorize(UserRole.SUPER_ADMIN), adminController.getUser);
router.put("/users/:id", authorize(UserRole.SUPER_ADMIN), adminController.updateUser);



// Audit log (Super Admin only)
router.get("/audit-log", authorize(UserRole.SUPER_ADMIN), adminController.getAuditLog);

// Health
router.get("/health", adminController.health);

export default router;
