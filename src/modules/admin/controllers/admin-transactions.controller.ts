import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { adminTransactionsService } from "../services/admin-transactions.service";

class AdminTransactionsController {
  stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminTransactionsService.getTransactionStats();
    res.json(successResponse(result));
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminTransactionsService.listTransactions(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  listBuy = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminTransactionsService.listTransactions({ ...req.query, tab: "buy" }, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  listSell = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminTransactionsService.listTransactions({ ...req.query, tab: "sell" }, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  listReceive = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminTransactionsService.listTransactions({ ...req.query, tab: "receive" }, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminTransactionsService.getTransaction(req.params.id);
    res.json(successResponse(result));
  });

  requestInfo = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.requestInformation(req.params.id, adminId, req.body);
    res.json(successResponse(result));
  });

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
