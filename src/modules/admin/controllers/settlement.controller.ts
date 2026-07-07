import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { settlementService } from "../services/settlement.service";
import { AuthRequest } from "../../../shared/middleware/auth";
import { ValidationError } from "../../../shared/utils/errors";

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

  createEscrowAccount = asyncHandler(async (req: AuthRequest, res: Response) => {
    if (!req.user) throw new ValidationError("Authentication required");
    const currency = req.body.currencyType || req.body.currency;
    const created = await settlementService.createEscrowAccount({
      currency,
      bankName: req.body.bankName,
      accountNumber: req.body.accountNumber,
      accountName: req.body.accountName,
      createdBy: req.user.userId,
    });
    res.status(201).json(successResponse(created));
  });

  bankList = asyncHandler(async (_req: Request, res: Response) => {
    const result = await settlementService.getBankList();
    res.json(successResponse(result));
  });

  verifyBankAccount = asyncHandler(async (req: Request, res: Response) => {
    const result = await settlementService.verifyBankAccount({
      accountNumber: req.body.accountNumber,
      bankCode: req.body.bankCode,
    });
    res.json(successResponse(result));
  });

  listInboundSettlements = asyncHandler(async (req: Request, res: Response) => {
    const page  = Math.max(1, parseInt(req.query.page  as string) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 20));
    const result = await settlementService.listInboundSettlements({
      status:        req.query.status        as string | undefined,
      paymentMethod: req.query.paymentMethod as string | undefined,
      currency:      req.query.currency      as string | undefined,
      startDate:     req.query.startDate     as string | undefined,
      endDate:       req.query.endDate       as string | undefined,
      q:             req.query.q             as string | undefined,
      page,
      limit,
    });
    res.json(successResponse(result.data, { pagination: result.meta }));
  });
}

export const settlementController = new SettlementController();
