import { Request, Response, NextFunction } from "express";
import adminService from "../services/admin.service";
import { auditTrailService } from "../services/audit-trail.service";
import { ActionType } from "../../../shared/types/action-type";
import { successResponse } from "../../../shared/utils";

class AdminController {
  getDashboard = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startDate = req.query.startDate ? String(req.query.startDate) : undefined;
      const endDate = req.query.endDate ? String(req.query.endDate) : undefined;
      const txnType = (req.query.txnType || req.query.type) ? String(req.query.txnType || req.query.type) : undefined;
      const range = (req.query.range || req.query.period) ? String(req.query.range || req.query.period) : undefined;
      const result = await adminService.getDashboard(startDate, endDate, txnType, range);
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

      await auditTrailService.logAction({
        adminId,
        actionType: ActionType.DEPOSIT_CONFIRM,
        actionLabel: "Confirm deposit",
        resourceType: "TRANSACTION",
        resourceId: req.params.transactionId,
        metadata: { paymentReference, proofOfPayment },
      });
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

  seedAdmin = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await adminService.seedAdminDefaults({
        email: req.body?.email,
        password: req.body?.password,
        name: req.body?.name,
      });
      res.status(result.created ? 201 : 200).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  health = async (_req: Request, res: Response) => {
    res.json({ status: "healthy", service: "admin-service" });
  };

}

export default new AdminController();
