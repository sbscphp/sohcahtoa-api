import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { streamCsv } from "../../../shared/utils";
import { outletService } from "../services/outlet.service";
import { auditTrailService } from "../services/audit-trail.service";
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
    const adminId = (req as any).user?.userId as string;
    await auditTrailService.logAction({
      adminId,
      actionType: "FRANCHISE_CREATE",
      actionLabel: "Create franchise",
      resourceType: "OUTLET",
      resourceId: data.id,
      newState: data,
    });
    res.json(successResponse(data));
  });

  updateFranchiseStatus = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as UpdateFranchiseStatusDto;
    const data = await outletService.updateFranchiseStatus(req.params.id, body.status);
    const adminId = (req as any).user?.userId as string;
    await auditTrailService.logAction({
      adminId,
      actionType: "FRANCHISE_UPDATE",
      actionLabel: "Update franchise status",
      resourceType: "OUTLET",
      resourceId: req.params.id,
      metadata: { status: body.status },
    });
    res.json(successResponse(data));
  });

  approveFranchise = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.approveFranchise(req.params.id);
    const adminId = (req as any).user?.userId as string;
    await auditTrailService.logAction({
      adminId,
      actionType: "FRANCHISE_APPROVE",
      actionLabel: "Approve franchise",
      resourceType: "OUTLET",
      resourceId: req.params.id,
      newState: data,
    });
    res.json(successResponse(data));
  });

  exportFranchises = asyncHandler(async (req: Request, res: Response) => {
    const rows = await outletService.exportFranchises({
      search: (req.query.search as string) || (req.query.q as string) || "",
      status: (req.query.status as string) || undefined,
    });
    streamCsv(
      res,
      "franchises.csv",
      [
        { header: "Franchise Name", select: (r: any) => r.franchiseName },
        { header: "Franchise ID", select: (r: any) => r.franchiseId },
        { header: "Contact Person", select: (r: any) => r.contactPerson },
        { header: "Contact Email", select: (r: any) => r.contactEmail },
        { header: "Contact Phone", select: (r: any) => r.contactPhone },
        { header: "Address", select: (r: any) => r.address },
        { header: "Status", select: (r: any) => r.status },
      ],
      rows as any[]
    );
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
    const adminId = (req as any).user?.userId as string;
    await auditTrailService.logAction({
      adminId,
      actionType: "BRANCH_CREATE",
      actionLabel: "Create branch",
      resourceType: "BRANCH",
      resourceId: data.id,
      newState: data,
    });
    res.json(successResponse(data));
  });

  getBranch = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.getBranch(req.params.id);
    res.json(successResponse(data));
  });

  updateBranchStatus = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.updateBranchStatus(req.params.id, req.body.status);
    const adminId = (req as any).user?.userId as string;
    await auditTrailService.logAction({
      adminId,
      actionType: "BRANCH_UPDATE",
      actionLabel: "Update branch status",
      resourceType: "BRANCH",
      resourceId: req.params.id,
      metadata: { status: req.body.status },
    });
    res.json(successResponse(data));
  });

  // exportBranches = asyncHandler(async (_req: Request, res: Response) => {
  //   const data = await outletService.exportBranches();
  //   res.json(successResponse(data));
  // });

  addAgents = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.addAgentsToBranch(req.params.id, req.body.agentIds || []);
    const adminId = (req as any).user?.userId as string;
    await auditTrailService.logAction({
      adminId,
      actionType: "BRANCH_ASSIGN_AGENTS",
      actionLabel: "Assign agents to branch",
      resourceType: "BRANCH",
      resourceId: req.params.id,
      metadata: { agentIds: req.body.agentIds || [] },
    });
    res.json(successResponse(data));
  });
}

export const outletController = new OutletController();
