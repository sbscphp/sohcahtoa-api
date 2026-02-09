import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { adminTransactionsService } from "../services/admin-transactions.service";

class AdminTransactionsController {
  review = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.reviewTransaction(req.params.id, adminId, req.body);
    res.json(successResponse(result));
  });

  approve = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.approveTransaction(req.params.id, adminId, req.body?.reason);
    res.json(successResponse(result));
  });

  reject = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.rejectTransaction(req.params.id, adminId, req.body?.reason);
    res.json(successResponse(result));
  });

  settle = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.settleTransaction(req.params.id, adminId, req.body);
    res.json(successResponse(result));
  });
}

export const adminTransactionsController = new AdminTransactionsController();
