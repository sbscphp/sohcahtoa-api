import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse, ValidationError } from "../../../shared/utils";
import { streamCsv } from "../../../shared/utils";
import { adminTransactionsService } from "../services/admin-transactions.service";
import { auditTrailService } from "../services/audit-trail.service";
import { ActionType } from "../../../shared/types/action-type";
import axios from "axios";

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
    const result = await adminTransactionsService.approveTransaction(req.params.id, adminId, notes, req.body?.sessionId);
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
    const result = await adminTransactionsService.getTotalBalance();
    res.json(successResponse(result));
  });

  refund = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const entryId = req.body?.entryId;
    const walletId = req.body?.walletId;
    const reason = req.body?.reason || req.body?.notes;
    const result = await adminTransactionsService.initiateTransactionRefund(req.params.id, adminId, reason, req.body?.sessionId);
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.WALLET_REFUND,
      actionLabel: "Refund transaction",
      resourceType: "WALLET",
      resourceId: walletId || req.params.id,
      reason: reason ? String(reason).trim() : undefined,
      metadata: { entryId },
    });

    res.json(successResponse(result));
  });

  initiateDisbursement = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const notes = req.body?.notes || req.body?.reason;
    const result = await adminTransactionsService.initiateDisbursement(req.params.id, adminId, notes);
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.DISBURSEMENT_INITIATE,
      actionLabel: "Initiate transaction disbursement approval workflow",
      resourceType: "TRANSACTION",
      resourceId: req.params.id,
      reason: notes,
    });
    res.json(successResponse(result));
  });

  approveDisbursement = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const notes = req.body?.notes || req.body?.reason;
    const result = await adminTransactionsService.approveDisbursement(req.params.id, adminId, notes);
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.DISBURSEMENT_APPROVE,
      actionLabel: "Approve transaction disbursement stage",
      resourceType: "TRANSACTION",
      resourceId: req.params.id,
      reason: notes,
    });
    res.json(successResponse(result));
  });

  rejectDisbursement = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const reason = req.body?.reason || req.body?.notes;
    const result = await adminTransactionsService.rejectDisbursement(req.params.id, adminId, reason);
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.DISBURSEMENT_REJECT,
      actionLabel: "Reject transaction disbursement workflow",
      resourceType: "TRANSACTION",
      resourceId: req.params.id,
      reason,
    });
    res.json(successResponse(result));
  });

  confirmDisbursement = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminTransactionsService.confirmDisbursement(
      req.params.id,
      adminId,
      req.body?.notes,
      req.body?.sessionId
    );
    await auditTrailService.logAction({
      adminId,
      actionType: "DISBURSEMENT_CONFIRMED",
      actionLabel: "Confirm disbursement",
      resourceType: "TRANSACTION",
      resourceId: req.params.id,
      metadata: { notes: req.body?.notes },
    });
    res.json(successResponse(result));
  });

  downloadTransactionReceipt = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const { url, filename } = await adminTransactionsService.getReceiptDownload(req.params.transactionId, adminId);
    if (!url) {
        throw new ValidationError('Receipt URL not available');
    }
    try {
        await this.pipeRemoteFile(res, url, filename);
    } catch (err: any) {
          throw new ValidationError(err?.message || "Unable to download receipt");
        }
  });

  private async pipeRemoteFile(res: Response, url: string, filename: string) {
    const upstream = await axios.get(url, { responseType: "stream" });
    const contentType = upstream.headers?.["content-type"] || "application/octet-stream";
    const contentLength = upstream.headers?.["content-length"];

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${this.safeFilename(filename)}"`);
    if (contentLength) res.setHeader("Content-Length", contentLength);

    upstream.data.pipe(res);
  }

  private safeFilename(name: string) {
    return String(name || "download")
      .replace(/[\r\n"]/g, "")
      .replace(/[\/\\?%*:|<>]/g, "-")
      .trim();
  }
}

export const adminTransactionsController = new AdminTransactionsController();
