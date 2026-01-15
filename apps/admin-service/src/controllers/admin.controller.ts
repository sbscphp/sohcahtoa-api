import { Request, Response, NextFunction } from "express";
import adminService from "../services/admin.service";
import { successResponse } from "@fx-platform/shared-utils";

class AdminController {
  getDashboard = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.getDashboard();
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  approveTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user?.userId as string;
      const { reason } = req.body;

      const result = await adminService.approveTransaction(req.params.id, adminId, reason);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  rejectTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user?.userId as string;
      const { reason } = req.body;

      const result = await adminService.rejectTransaction(req.params.id, adminId, reason);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /**
   * REVIEW (Requirement)
   * This is typically where compliance/admin add notes and confirm transaction can move into ADMIN_REVIEW step.
   */
  reviewTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user?.userId as string;
      const { notes, riskLevel, amlDecision } = req.body;

      const result = await adminService.reviewTransaction(req.params.id, adminId, {
        notes,
        riskLevel,
        amlDecision,
      });

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /**
   * SETTLE (Requirement)
   * In your enums, "settle" maps to DISBURSEMENT step.
   */
  settleTransaction = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user?.userId as string;
      const { disbursementMethod, settlementReference } = req.body;

      const result = await adminService.settleTransaction(req.params.id, adminId, {
        disbursementMethod,
        settlementReference,
      });

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  confirmDeposit = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user?.userId as string;
      const { paymentReference, proofOfPayment } = req.body;

      const result = await adminService.confirmDeposit(
        req.params.transactionId,
        adminId,
        paymentReference,
        proofOfPayment
      );

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getPendingApprovals = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user?.userId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await adminService.getPendingApprovals(adminId, page, limit);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getAdminActions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user?.userId as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await adminService.getAdminActions(adminId, page, limit);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getAuditLog = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await adminService.getAuditLog(req.query, page, limit);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  health = async (_req: Request, res: Response) => {
    res.json({ status: "healthy", service: "admin-service" });
  };
}

export default new AdminController();
