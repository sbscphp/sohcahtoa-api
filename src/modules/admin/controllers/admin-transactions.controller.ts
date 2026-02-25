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

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminTransactionsService.listTransactions(req.query, 1, 10000);
    const rows = result.data || [];
    const headers = ["id","reference","date","customerName","transactionType","transactionStage","workflowStage","transactionValue","status"];
    const csv =
      headers.join(",") + "\n" +
      rows.map((r: any) => [
        r.id,
        r.dateAndId?.reference || "",
        r.dateAndId?.date ? new Date(r.dateAndId.date).toISOString() : "",
        r.customerName || "",
        r.transactionType || "",
        r.transactionStage || "",
        r.workflowStage || "",
        typeof r.transactionValue === "number" ? r.transactionValue : "",
        r.status || ""
      ].map((v) => typeof v === "string" ? `"${v.replace(/"/g, '""')}"` : v).join(",")).join("\n");
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", 'attachment; filename="transactions.csv"');
    res.send(csv);
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
