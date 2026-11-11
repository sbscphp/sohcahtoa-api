import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse, ValidationError, streamCsv } from "../../../shared/utils";
import { fxInventoryService } from "../services/fx-inventory.service";
import { fxInventoryAgentService } from "../services/fx-inventory-agent.service";

class FxInventoryController {
  listBalances = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryService.listInventoryBalances({
      branchId: req.query.branchId as string | undefined,
      currency: req.query.currency as string | undefined,
    });
    res.json(successResponse(data));
  });

  // ── Agent-level FX inventory (Outlet Management → Agent FX Inventory) ─────

  private dateFilters(req: Request) {
    return {
      date: req.query.date as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      currency: req.query.currency as string | undefined,
    };
  }

  listAgents = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryAgentService.listAgents({
      search: (req.query.search || req.query.keyword) as string | undefined,
      branchId: req.query.branchId as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json(successResponse(data.data, { pagination: data.pagination }));
  });

  exportAgents = asyncHandler(async (req: Request, res: Response) => {
    const { data } = await fxInventoryAgentService.listAgents({
      search: (req.query.search || req.query.keyword) as string | undefined,
      branchId: req.query.branchId as string | undefined,
      all: true,
    });
    streamCsv(res, "agent-fx-inventory.csv", [
      { header: "Agent", select: (r: any) => r.name },
      { header: "Email", select: (r: any) => r.email },
      { header: "Phone", select: (r: any) => r.phoneNumber },
      { header: "Branch", select: (r: any) => r.branchName },
      { header: "Total Disbursement", select: (r: any) => r.totalDisbursements },
      { header: "Total Lodgment", select: (r: any) => r.totalLodgments },
    ], data as any[]);
  });

  getAgentOverview = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryAgentService.getAgentOverview(req.params.agentId, this.dateFilters(req));
    res.json(successResponse(data));
  });

  getAgentInventoryPosition = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryAgentService.getInventoryPosition(req.params.agentId, this.dateFilters(req));
    res.json(successResponse(data));
  });

  exportAgentInventoryPosition = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryAgentService.getInventoryPosition(req.params.agentId, this.dateFilters(req));
    const rows = [...data.rows, { ...data.total, currency: "TOTAL (NGN)" }];
    streamCsv(res, "inventory-position.csv", [
      { header: "Currency", select: (r: any) => r.currency },
      { header: "Opening Balance", select: (r: any) => r.openingBalance },
      { header: "Disbursed from Admin", select: (r: any) => r.disbursedFromAdmin },
      { header: "Purchased from Customers", select: (r: any) => r.purchasedFromCustomers },
      { header: "Sold to Customers", select: (r: any) => r.soldToCustomers },
      { header: "Lodged to HQ", select: (r: any) => r.lodgedToHq },
      { header: "Closing Balance", select: (r: any) => r.closingBalance },
      { header: "Physical Count", select: (r: any) => r.physicalCount ?? "" },
      { header: "Variance", select: (r: any) => r.variance ?? "" },
    ], rows as any[]);
  });

  recordPhysicalCount = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const data = await fxInventoryAgentService.recordPhysicalCount(adminId, req.params.agentId, req.body || {});
    res.status(201).json(successResponse(data));
  });

  getLodgment = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryAgentService.getLodgment(req.params.id);
    res.json(successResponse(data));
  });

  exportLodgments = asyncHandler(async (req: Request, res: Response) => {
    const { data } = await fxInventoryService.listLodgments({
      status: req.query.status as string | undefined,
      branchId: req.query.branchId as string | undefined,
      agentId: req.query.agentId as string | undefined,
      currency: req.query.currency as string | undefined,
      search: (req.query.search || req.query.keyword) as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      page: 1,
      limit: 100,
    });
    streamCsv(res, "cash-lodgments.csv", [
      { header: "Reference", select: (r: any) => r.referenceNumber },
      { header: "Currency", select: (r: any) => r.currency },
      { header: "Amount Lodged", select: (r: any) => r.statedAmount },
      { header: "Updated Amount", select: (r: any) => r.confirmedAmount ?? "" },
      { header: "Timestamp", select: (r: any) => r.submittedAt },
      { header: "Status", select: (r: any) => r.status },
    ], data as any[]);
  });

  getStats = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryService.getStats({
      branchId: req.query.branchId as string | undefined,
      agentId: req.query.agentId as string | undefined,
    });
    res.json(successResponse(data));
  });

  getHistory = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryService.getInventoryHistory({
      branchId: req.query.branchId as string | undefined,
      currency: req.query.currency as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json(successResponse(data.data, { pagination: data.pagination }));
  });

  // ── Disbursement ──────────────────────────────────────────────────────────

  initiateDisbursement = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const { agentId, currency, amount, purpose } = req.body;
    if (!agentId) throw new ValidationError("agentId is required");
    if (!currency) throw new ValidationError("currency is required");
    const data = await fxInventoryService.initiateDisbursement(adminId, { agentId, currency, amount, purpose });
    res.status(201).json(successResponse(data));
  });

  listDisbursements = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryService.listDisbursements({
      currency: req.query.currency as string | undefined,
      search: (req.query.search || req.query.keyword) as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      status: req.query.status as string | undefined,
      branchId: req.query.branchId as string | undefined,
      agentId: req.query.agentId as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json(successResponse(data.data, { pagination: data.pagination }));
  });

  getDisbursementForApproval = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string | undefined;
    const data = await fxInventoryService.getDisbursementForApproval(req.params.id, adminId);
    res.json(successResponse(data));
  });

  approveDisbursement = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const data = await fxInventoryService.approveDisbursement(req.params.id, adminId, req.body?.reason);
    res.json(successResponse(data));
  });

  rejectDisbursement = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    if (!req.body?.reason) throw new ValidationError("reason is required");
    const data = await fxInventoryService.rejectDisbursement(req.params.id, adminId, req.body.reason);
    res.json(successResponse(data));
  });

  // ── Lodgment ──────────────────────────────────────────────────────────────

  listLodgments = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryService.listLodgments({
      currency: req.query.currency as string | undefined,
      search: (req.query.search || req.query.keyword) as string | undefined,
      dateFrom: req.query.dateFrom as string | undefined,
      dateTo: req.query.dateTo as string | undefined,
      status: req.query.status as string | undefined,
      branchId: req.query.branchId as string | undefined,
      agentId: req.query.agentId as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json(successResponse(data.data, { pagination: data.pagination }));
  });

  confirmLodgment = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const data = await fxInventoryService.confirmLodgment(req.params.id, adminId, req.body?.confirmedAmount, req.body?.reason);
    res.json(successResponse(data));
  });

  rejectLodgment = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    if (!req.body?.reason) throw new ValidationError("reason is required");
    const data = await fxInventoryService.rejectLodgment(req.params.id, adminId, req.body.reason);
    res.json(successResponse(data));
  });
}

export const fxInventoryController = new FxInventoryController();
export default fxInventoryController;
