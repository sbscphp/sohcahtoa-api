import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { outletService } from "../services/outlet.service";
import { CreateFranchiseDto, FranchiseQueryDto, UpdateFranchiseStatusDto, CreateBranchDto } from "../dto/outlet.dto";

class OutletController {
  list = asyncHandler(async (_req: Request, res: Response) => {
    const data = await outletService.listOutlets();
    res.json(successResponse(data));
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.getOutlet(req.params.name);
    res.json(successResponse(data));
  });

  franchiseStats = asyncHandler(async (_req: Request, res: Response) => {
    const data = await outletService.getFranchiseStats();
    res.json(successResponse(data));
  });

  listFranchises = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.listFranchises(req.query as unknown as FranchiseQueryDto);
    res.json(successResponse(data));
  });

  createFranchise = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.createFranchise(req.body as CreateFranchiseDto);
    res.json(successResponse(data));
  });

  updateFranchiseStatus = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as UpdateFranchiseStatusDto;
    const data = await outletService.updateFranchiseStatus(req.params.id, body.status);
    res.json(successResponse(data));
  });

  approveFranchise = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.approveFranchise(req.params.id);
    res.json(successResponse(data));
  });

  exportFranchises = asyncHandler(async (_req: Request, res: Response) => {
    const data = await outletService.exportFranchises();
    res.json(successResponse(data));
  });

  branchStats = asyncHandler(async (_req: Request, res: Response) => {
    const data = await outletService.getBranchStats();
    res.json(successResponse(data));
  });

  listBranches = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.listBranches(req.query);
    res.json(successResponse(data));
  });

  createBranch = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.createBranch(req.body as CreateBranchDto);
    res.json(successResponse(data));
  });

  getBranch = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.getBranch(req.params.id);
    res.json(successResponse(data));
  });

  updateBranchStatus = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.updateBranchStatus(req.params.id, req.body.status);
    res.json(successResponse(data));
  });

  exportBranches = asyncHandler(async (_req: Request, res: Response) => {
    const data = await outletService.exportBranches();
    res.json(successResponse(data));
  });

  addAgents = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.addAgentsToBranch(req.params.id, req.body.agentIds || []);
    res.json(successResponse(data));
  });
}

export const outletController = new OutletController();
