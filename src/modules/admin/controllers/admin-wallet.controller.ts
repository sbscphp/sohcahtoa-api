import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { streamCsv } from "../../../shared/utils/csv";
import { adminWalletService } from "../services/admin-wallet.service";
import { workflowService } from "../services/workflow.service";
import { auditTrailService } from "../services/audit-trail.service";
import { ActionType } from "../../../shared/types/action-type";

class AdminWalletController {

  /**
   * GET /api/admin/wallet
   * List all transient wallets with search, filter, sort, and pagination.
   */
  list = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminWalletService.listWallets(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  /**
   * GET /api/admin/wallet/export
   * Export all wallets as CSV.
   */
  exportCsv = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminWalletService.listWallets(req.query, 1, 10000);
    const rows = result.data || [];
    streamCsv(
      res,
      "transient-wallets.csv",
      [
        { header: "Wallet ID", select: (r: any) => r.walletId || "" },
        { header: "Customer Name", select: (r: any) => r.customerName || "" },
        {
          header: "Date & Time",
          select: (r: any) =>
            r.createdAt ? new Date(r.createdAt).toISOString() : "",
        },
        { header: "Total Debits", select: (r: any) => r.totalDebits },
        { header: "Total Credits", select: (r: any) => r.totalCredits },
        { header: "Balance", select: (r: any) => r.balance },
        { header: "Currency", select: (r: any) => r.currency || "NGN" },
        { header: "Status", select: (r: any) => (r.isActive ? "Active" : "Inactive") },
      ],
      rows as any[]
    );
  });

  /**
   * GET /api/admin/wallet/:id
   * Get a single wallet by wallet ID.
   */
  get = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminWalletService.getWalletById(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, message: "Wallet not found" });
      return;
    }
    res.json(successResponse(result));
  });

  /**
   * GET /api/admin/wallet/:id/ledger
   * Get paginated ledger entries for a wallet.
   */
  getLedger = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminWalletService.getWalletLedger(req.params.id, {
      page,
      limit,
      type: req.query.type as "DEBIT" | "CREDIT" | undefined,
      status: req.query.status as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      search: req.query.search as string | undefined,
      matchStatus: req.query.matchStatus as string | undefined,
      sortBy: req.query.sortBy as string | undefined,
      sortOrder: req.query.sortOrder as string | undefined,
    });
    if (!result) {
      res.status(404).json({ success: false, message: "Wallet not found" });
      return;
    }
    res.json(successResponse(result.entries, { wallet: result.wallet, pagination: result.meta }));
  });

  /**
   * GET /api/admin/wallet/:id/ledger/export
   * Export wallet ledger entries as CSV.
   */
  exportLedgerCsv = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminWalletService.getWalletLedger(req.params.id, {
      page: 1,
      limit: 10000,
      type: req.query.type as "DEBIT" | "CREDIT" | undefined,
      status: req.query.status as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      search: req.query.search as string | undefined,
      matchStatus: req.query.matchStatus as string | undefined,
    });
    if (!result) {
      res.status(404).json({ success: false, message: "Wallet not found" });
      return;
    }
    const rows = result.entries || [];
    streamCsv(
      res,
      "wallet-ledger.csv",
      [
        { header: "Entry ID", select: (r: any) => r.id || "" },
        { header: "Type", select: (r: any) => r.type || "" },
        { header: "Amount", select: (r: any) => r.amount },
        { header: "Balance Before", select: (r: any) => r.balanceBefore },
        { header: "Balance After", select: (r: any) => r.balanceAfter },
        { header: "Description", select: (r: any) => r.description || "" },
        { header: "Status", select: (r: any) => r.status || "" },
        { header: "Match Status", select: (r: any) => r.matchStatus || "" },
        { header: "Link Reason", select: (r: any) => r.linkReason || "" },
        { header: "Transaction Ref", select: (r: any) => r.transactionRef || "" },
        {
          header: "Date & Time",
          select: (r: any) =>
            r.createdAt ? new Date(r.createdAt).toISOString() : "",
        },
      ],
      rows as any[]
    );
  });

  /**
   * GET /api/admin/wallet/:id/ledger/:entryId
   * Get a specific ledger entry by ID.
   */
  getEntry = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId;
    const result = await adminWalletService.getEntryById(req.params.id, req.params.entryId);
    if (!result) {
      res.status(404).json({ success: false, message: "Entry not found" });
      return;
    }
    const approvalProcess = await workflowService.getActiveWorkflowState(result as any, adminId);
    res.json(successResponse({ ...result, approvalProcess }));
  });

  /**
   * GET /api/admin/wallet/:id/customer
   * Get customer details for a wallet.
   */
  getCustomer = asyncHandler(async (req: Request, res: Response) => {
    const result = await adminWalletService.getCustomerForWallet(req.params.id);
    if (!result) {
      res.status(404).json({ success: false, message: "Wallet or customer not found" });
      return;
    }
    res.json(successResponse(result));
  });

  /**
   * POST /api/admin/wallet/:id/ledger/:entryId/notes
   * Add a note to a ledger entry.
   */
  addNote = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const { note } = req.body;
    if (!note || !note.trim()) {
      res.status(400).json({ success: false, message: "Note is required" });
      return;
    }
    const result = await adminWalletService.addEntryNote(req.params.id, req.params.entryId, adminId, note.trim());
    if (!result) {
      res.status(404).json({ success: false, message: "Entry not found" });
      return;
    }
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.WALLET_ADD_NOTE,
      actionLabel: "Add note to wallet entry",
      resourceType: "WALLET",
      resourceId: req.params.id,
      metadata: { entryId: req.params.entryId, noteId: result.id },
    });
    res.status(201).json(successResponse(result));
  });

  /**
   * GET /api/admin/wallet/:id/ledger/:entryId/notes
   * Get notes for a ledger entry.
   */
  getNotes = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminWalletService.getEntryNotes(req.params.id, req.params.entryId, page, limit);
    if (!result) {
      res.status(404).json({ success: false, message: "Entry not found" });
      return;
    }
    res.json(successResponse(result.notes, { pagination: result.meta }));
  });

  /**
   * POST /api/admin/wallet/:id/ledger/:entryId/link-transaction
   * Link a transaction to an entry.
   */
  linkTransaction = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const { transactionId, reason } = req.body;
    let result;
    if (transactionId) {
      if (!reason || !reason.trim()) {
        res.status(400).json({ success: false, message: "Reason is required when manually linking" });
        return;
      }
      result = await adminWalletService.linkTransaction(
        req.params.id,
        req.params.entryId,
        transactionId,
        adminId,
        reason.trim()
      );
    } else {
      result = await adminWalletService.autoLinkTransaction(
        req.params.id,
        req.params.entryId,
        adminId,
        reason?.trim()
      );
    }

    if (!result) {
      res.status(404).json({ success: false, message: "Entry not found" });
      return;
    }
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.WALLET_LINK_TRANSACTION,
      actionLabel: "Link transaction to wallet entry",
      resourceType: "WALLET",
      resourceId: req.params.id,
      metadata: { entryId: req.params.entryId, transactionId, reason: reason.trim() },
    });
    res.json(successResponse(result));
  });

  /**
   * DELETE /api/admin/wallet/:id/ledger/:entryId/link-transaction
   * Unlink a transaction from an entry.
   */
  unlinkTransaction = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminWalletService.unlinkTransaction(req.params.id, req.params.entryId, adminId);
    if (!result) {
      res.status(404).json({ success: false, message: "Entry not found" });
      return;
    }
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.WALLET_UNLINK_TRANSACTION,
      actionLabel: "Unlink transaction from wallet entry",
      resourceType: "WALLET",
      resourceId: req.params.id,
      metadata: { entryId: req.params.entryId },
    });
    res.json(successResponse(result));
  });

  /**
   * POST /api/admin/wallet/:id/ledger/:entryId/flag
   * Flag an entry for review.
   */
  flagEntry = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const { reason } = req.body;
    if (!reason || !reason.trim()) {
      res.status(400).json({ success: false, message: "Reason is required" });
      return;
    }
    const result = await adminWalletService.flagEntry(req.params.id, req.params.entryId, adminId, reason.trim());
    if (!result) {
      res.status(404).json({ success: false, message: "Entry not found" });
      return;
    }
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.WALLET_FLAG_ENTRY,
      actionLabel: "Flag wallet entry",
      resourceType: "WALLET",
      resourceId: req.params.id,
      reason: reason.trim(),
      metadata: { entryId: req.params.entryId },
    });
    res.json(successResponse(result));
  });

  /**
   * POST /api/admin/wallet/:id/ledger/:entryId/refund
   * Initiate a refund for an entry.
   */
  refund = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminWalletService.initiateRefund(req.params.id, req.params.entryId, adminId);
    if (!result) {
      res.status(404).json({ success: false, message: "Entry not found" });
      return;
    }
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.WALLET_REFUND,
      actionLabel: "Initiate wallet entry refund",
      resourceType: "WALLET",
      resourceId: req.params.id,
      metadata: { entryId: req.params.entryId },
    });
    res.json(successResponse(result));
  });

  /**
   * POST /api/admin/wallet/:id/ledger/:entryId/refund/approve
   * Approve a refund for an entry.
   */
  approveRefund = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminWalletService.approveRefund(req.params.id, req.params.entryId, adminId, req.body.notes || req.body.reason);
    if (!result) {
      res.status(404).json({ success: false, message: "Entry not found" });
      return;
    }
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.WALLET_REFUND,
      actionLabel: "Approve wallet entry refund",
      resourceType: "WALLET",
      resourceId: req.params.id,
      metadata: { entryId: req.params.entryId, action: "APPROVE", reason: req.body.notes || req.body.reason },
    });
    res.json(successResponse(result));
  });

  /**
   * POST /api/admin/wallet/:id/ledger/:entryId/refund/reject
   * Reject a refund for an entry.
   */
  rejectRefund = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminWalletService.rejectRefund(req.params.id, req.params.entryId, adminId, req.body.reason || req.body.notes);
    if (!result) {
      res.status(404).json({ success: false, message: "Entry not found" });
      return;
    }
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.WALLET_REFUND,
      actionLabel: "Reject wallet entry refund",
      resourceType: "WALLET",
      resourceId: req.params.id,
      metadata: { entryId: req.params.entryId, action: "REJECT", reason: req.body.reason || req.body.notes },
    });
    res.json(successResponse(result));
  });

  /**
   * POST /api/admin/wallet/:id/ledger/:entryId/disburse
   */
  disburse = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const result = await adminWalletService.confirmDisbursement(req.params.id, req.params.entryId, adminId);
    if (!result) {
      res.status(404).json({ success: false, message: "Entry not found" });
      return;
    }
    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.WALLET_DISBURSE,
      actionLabel: "Confirm wallet entry disbursement",
      resourceType: "WALLET",
      resourceId: req.params.id,
      metadata: { entryId: req.params.entryId },
    });
    res.json(successResponse(result));
  });

  /**
   * GET /api/admin/wallet/:id/ledger/:entryId/audit-logs
   * Get audit logs for a specific ledger entry.
   */
  getEntryAuditLogs = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await adminWalletService.getEntryAuditLogs(
      req.params.id,
      req.params.entryId,
      page,
      limit
    );
    if (!result) {
      res.status(404).json({ success: false, message: "Ledger entry not found" });
      return;
    }
    res.json(successResponse(result.logs, { pagination: result.meta }));
  });
}

export const adminWalletController = new AdminWalletController();
