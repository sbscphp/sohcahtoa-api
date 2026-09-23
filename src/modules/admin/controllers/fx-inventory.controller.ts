import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse, ValidationError } from "../../../shared/utils";
import { fxInventoryService } from "../services/fx-inventory.service";

class FxInventoryController {
  listBalances = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryService.listInventoryBalances({
      branchId: req.query.branchId as string | undefined,
      currency: req.query.currency as string | undefined,
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
      status: req.query.status as string | undefined,
      branchId: req.query.branchId as string | undefined,
      agentId: req.query.agentId as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json(successResponse(data.data, { pagination: data.pagination }));
  });

  getDisbursementForApproval = asyncHandler(async (req: Request, res: Response) => {
    const data = await fxInventoryService.getDisbursementForApproval(req.params.id);
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
