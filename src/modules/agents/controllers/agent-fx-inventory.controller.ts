import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse, ValidationError } from "../../../shared/utils";
import { agentFxInventoryService } from "../services/agent-fx-inventory.service";

class AgentFxInventoryController {
  getMyBalances = asyncHandler(async (req: Request, res: Response) => {
    const agentUserId = (req as any).user?.userId as string;
    const data = await agentFxInventoryService.getMyCashBalances(agentUserId);
    res.json(successResponse(data));
  });

  lodgeCash = asyncHandler(async (req: Request, res: Response) => {
    const agentUserId = (req as any).user?.userId as string;
    const { currency, amount, notes } = req.body;
    if (!currency) throw new ValidationError("currency is required");
    const data = await agentFxInventoryService.lodgeCash(agentUserId, { currency, amount, notes });
    res.status(201).json(successResponse(data));
  });

  listMyLodgments = asyncHandler(async (req: Request, res: Response) => {
    const agentUserId = (req as any).user?.userId as string;
    const data = await agentFxInventoryService.listMyLodgments(agentUserId, {
      status: req.query.status as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json(successResponse(data.data, { pagination: data.pagination }));
  });

  listMyDisbursements = asyncHandler(async (req: Request, res: Response) => {
    const agentUserId = (req as any).user?.userId as string;
    const data = await agentFxInventoryService.listMyDisbursements(agentUserId, {
      status: req.query.status as string | undefined,
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
    });
    res.json(successResponse(data.data, { pagination: data.pagination }));
  });
}

export const agentFxInventoryController = new AgentFxInventoryController();
export default agentFxInventoryController;
