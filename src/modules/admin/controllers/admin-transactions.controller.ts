import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { streamCsv } from "../../../shared/utils";
import { adminTransactionsService } from "../services/admin-transactions.service";
import { auditTrailService } from "../services/audit-trail.service";
import { ActionType } from "../../../shared/types/action-type";

class AdminTransactionsController {
  stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminTransactionsService.getTransactionStats();
    res.json(successResponse(result));
  });

  types = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminTransactionsService.getTransactionTypes();
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
    const result = await adminTransactionsService.listBuyTransactions(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  listSell = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminTransactionsService.listSellTransactions(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  listReceive = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminTransactionsService.listReceiveTransactions(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminTransactionsService.listTransactions(req.query, 1, 10000);
    const rows = result.data || [];
    streamCsv(
      res,
      "transactions.csv",
      [
        { header: "Customer Name", select: (r: any) => r.customerName || "" },
        { header: "Date and ID", select: (r: any) => {
            const d = r.dateAndId?.date;
            const ref = r.dateAndId?.reference || "";
            const iso = d ? new Date(d).toISOString() : "";
            return iso ? `${iso} ${ref ? `(${ref})` : ""}` : ref;
          } 
        },
        { header: "Transaction Type", select: (r: any) => r.transactionType || "" },
        { header: "Transaction Stage", select: (r: any) => r.transactionStage || "" },
        { header: "Workflow Stage", select: (r: any) => r.workflowStage || "" },
        { header: "Transaction Value", select: (r: any) => r.transactionValue },
        { header: "Status", select: (r: any) => r.status || "" },
      ],
      rows as any[]
    );
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.getTransaction(req.params.id, adminId);
    res.json(successResponse(result));
  });

  requestInfo = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.requestInformation(req.params.id, adminId, req.body);
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.COMPLIANCE_REVIEW,
      actionLabel: "Request additional information",
      resourceType: "TRANSACTION",
      resourceId: req.params.id,
      metadata: { ...req.body },
    });
    res.json(successResponse(result));
  });

  review = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.reviewTransaction(req.params.id, adminId, req.body);
    await auditTrailService.logAction({
      adminId,
      actionType: "TRANSACTION_REVIEW",
      actionLabel: "Review transaction",
      resourceType: "TRANSACTION",
      resourceId: req.params.id,
      metadata: { ...req.body },
    });
    res.json(successResponse(result));
  });

  approve = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const notes = req.body?.notes || req.body?.reason;
    const result = await adminTransactionsService.approveTransaction(req.params.id, adminId, notes);
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.TRANSACTION_APPROVE,
      actionLabel: "Approve transaction",
      resourceType: "TRANSACTION",
      resourceId: req.params.id,
      reason: notes,
    });
    res.json(successResponse(result));
  });

  reject = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.rejectTransaction(req.params.id, adminId, req.body?.reason);
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.TRANSACTION_REJECT,
      actionLabel: "Reject transaction",
      resourceType: "TRANSACTION",
      resourceId: req.params.id,
      reason: req.body?.reason,
    });
    res.json(successResponse(result));
  });

  approveDocument = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.approveTransactionDocument(
      req.params.id,
      req.params.documentId,
      adminId,
      req.body?.notes
    );
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.DOCUMENT_APPROVE,
      actionLabel: "Approve transaction document",
      resourceType: "TRANSACTION_DOCUMENT",
      resourceId: req.params.documentId,
      metadata: { transactionId: req.params.id, notes: req.body?.notes },
    });
    res.json(successResponse(result));
  });

  rejectDocument = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const reason = (req.body?.reason || req.body?.notes || "") as string;
    const result = await adminTransactionsService.rejectTransactionDocument(
      req.params.id,
      req.params.documentId,
      adminId,
      reason
    );
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.DOCUMENT_REJECT,
      actionLabel: "Reject transaction document",
      resourceType: "TRANSACTION_DOCUMENT",
      resourceId: req.params.documentId,
      reason,
      metadata: { transactionId: req.params.id },
    });
    res.json(successResponse(result));
  });

  requestMoreInfoOnDocument = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.requestMoreInfoOnTransactionDocument(
      req.params.id,
      req.params.documentId,
      adminId,
      req.body?.comment
    );
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.COMPLIANCE_REVIEW,
      actionLabel: "Request more information on document review",
      resourceType: "TRANSACTION_DOCUMENT",
      resourceId: req.params.documentId,
      metadata: { transactionId: req.params.id, comment: req.body?.comment },
    });
    res.json(successResponse(result));
  });

  settle = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.settleTransaction(req.params.id, adminId, req.body);
    await auditTrailService.logAction({
      adminId,
      actionType: "TRANSACTION_SETTLE",
      actionLabel: "Settle transaction",
      resourceType: "TRANSACTION",
      resourceId: req.params.id,
      metadata: { ...req.body },
    });
    res.json(successResponse(result));
  });

  unsettledBalance = asyncHandler(async (_req: Request, res: Response) => {
    const result = await adminTransactionsService.getUnsettledTransactionBalance();
    res.json(successResponse(result));
  });

  totalBalance = asyncHandler(async (req: Request, res: Response) => {
    const currency = (req.query.currency as string) || "NGN";
    const result = await adminTransactionsService.getTotalBalance(currency);
    res.json(successResponse(result));
  });
}

export const adminTransactionsController = new AdminTransactionsController();
