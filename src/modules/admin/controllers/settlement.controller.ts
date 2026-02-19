import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { settlementService } from "../services/settlement.service";

class SettlementController {
  stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await settlementService.stats();
    res.json(successResponse(result));
  });

  discrepancies = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await settlementService.discrepancies(page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  pendingReconciliations = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await settlementService.pendingReconciliations(page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  escrowAccounts = asyncHandler(async (_req: Request, res: Response) => {
    const result = await settlementService.escrowAccounts();
    res.json(successResponse(result));
  });

  fundingTransactions = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const result = await settlementService.fundingTransactions(page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });
}

export const settlementController = new SettlementController();
