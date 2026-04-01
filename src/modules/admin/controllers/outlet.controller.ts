import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { streamCsv } from "../../../shared/utils";
import { outletService } from "../services/outlet.service";
import { auditTrailService } from "../services/audit-trail.service";
import {
  CreateFranchiseDto,
  FranchiseQueryDto,
  UpdateFranchiseStatusDto,
  CreateBranchDto,
  UpdateFranchiseDto,
  CreatePickupStationDto,
  PickupStationQueryDto,
  UpdatePickupStationDto,
} from "../dto/outlet.dto";
import statesCities from "../../../shared/utils/states-cities.json";
import { NotFoundError, ValidationError } from "../../../shared/utils/errors";

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

  listPickupStations = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.listPickupStations(req.query as unknown as PickupStationQueryDto);
    res.json(successResponse(data.items, { pagination: data.pagination }));
  });

  exportPickupStations = asyncHandler(async (req: Request, res: Response) => {
    const rows = await outletService.exportPickupStations(req.query as unknown as PickupStationQueryDto);
    streamCsv(
      res,
      "pickup-stations.csv",
      [
        { header: "Station ID", select: (r: any) => r.id },
        { header: "Station Name", select: (r: any) => r.stationName },
        { header: "Station Email", select: (r: any) => r.stationEmail },
        { header: "Phone Number", select: (r: any) => r.phoneNumber },
        { header: "State", select: (r: any) => r.state },
        { header: "Region", select: (r: any) => r.region },
        { header: "Physical Address", select: (r: any) => r.physicalAddress },
        { header: "Status", select: (r: any) => r.status },
        { header: "Active", select: (r: any) => (r.isActive ? "Active" : "Deactivated") },
        { header: "Created At", select: (r: any) => (r.createdAt ? new Date(r.createdAt).toISOString() : "") },
        { header: "Updated At", select: (r: any) => (r.updatedAt ? new Date(r.updatedAt).toISOString() : "") },
      ],
      rows as any[]
    );
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

  createPickupStation = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.createPickupStation(req.body as CreatePickupStationDto);
    const adminId = (req as any).user?.userId as string;
    await auditTrailService.logAction({
      adminId,
      actionType: "PICKUP_STATION_CREATE",
      actionLabel: "Create pick-up station",
      resourceType: "PICKUP_STATION",
      resourceId: data.id,
      newState: data,
    });
    res.json(successResponse(data));
  });

  updateFranchiseStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body as { status: boolean };

    if (typeof status !== "boolean") {
      throw new ValidationError("status must be a boolean");
    }

    const resolvedStatus: "Active" | "Deactivated" = status ? "Active" : "Deactivated";

    const data = await outletService.updateFranchiseStatus(
      req.params.id,
      resolvedStatus
    );

    const adminId = (req as any).user?.userId as string;

    await auditTrailService.logAction({
      adminId,
      actionType: "FRANCHISE_UPDATE",
      actionLabel: "Update franchise status",
      resourceType: "OUTLET",
      resourceId: req.params.id,
      metadata: { status: resolvedStatus },
    });

    res.json(successResponse(data));
  }); 

  updateFranchise = asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as UpdateFranchiseDto;
    const adminId = (req as any).user?.userId as string;
    const before = await outletService.getFranchise(req.params.id);
    const data = await outletService.updateFranchise(req.params.id, body);
    await auditTrailService.logAction({
      adminId,
      actionType: "FRANCHISE_UPDATE",
      actionLabel: "Update franchise",
      resourceType: "OUTLET",
      resourceId: req.params.id,
      previousState: before,
      newState: data,
    });
    res.json(successResponse(data));
  });

  getPickupStation = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.getPickupStation(req.params.id);
    res.json(successResponse(data));
  });

  updatePickupStation = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const before = await outletService.getPickupStation(req.params.id);
    const updated = await outletService.updatePickupStation(req.params.id, req.body as UpdatePickupStationDto);
    await auditTrailService.logAction({
      adminId,
      actionType: "PICKUP_STATION_UPDATE",
      actionLabel: "Update pick-up station",
      resourceType: "PICKUP_STATION",
      resourceId: req.params.id,
      previousState: before,
      newState: updated,
    });
    res.json(successResponse(updated));
  });

  deletePickupStation = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const before = await outletService.getPickupStation(req.params.id);
    const data = await outletService.deletePickupStation(req.params.id);
    await auditTrailService.logAction({
      adminId,
      actionType: "PICKUP_STATION_DELETE",
      actionLabel: "Delete pick-up station",
      resourceType: "PICKUP_STATION",
      resourceId: req.params.id,
      previousState: before,
      newState: data,
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

  getFranchise = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.getFranchise(req.params.id);
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

  exportBranches = asyncHandler(async (req: Request, res: Response) => {
    const rows = await outletService.exportBranches({
      search: (req.query.search as string) || "",
      status: (req.query.status as string) || undefined,
    });
    streamCsv(
      res,
      "branches.csv",
      [
        { header: "Branch ID", select: (r: any) => r.id },
        { header: "Branch Name", select: (r: any) => r.branchName },
        { header: "Branch Manager", select: (r: any) => r.branchManager },
        { header: "Email", select: (r: any) => r.email },
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
    res.json(successResponse(data.items, { pagination: data.pagination }));
  });

  listAllBranches = asyncHandler(async (req: Request, res: Response) => {
    const q = ((req.query.search as string) || "").toString();
    const data = await outletService.listBranchesAll(q);
    res.json(successResponse(data));
  });

  listFranchiseBranches = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await outletService.listBranchesByFranchise(req.params.id, req.query, page, limit);
    res.json(successResponse(result.items, { pagination: result.pagination }));
  });

  listFranchiseBranchesAll = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.listBranchesByFranchiseAll(req.params.id, req.query);
    res.json(successResponse(data));
  });

  exportFranchiseBranches = asyncHandler(async (req: Request, res: Response) => {
    const rows = await outletService.exportBranchesByFranchise(req.params.id, req.query);
    streamCsv(
      res,
      "franchise-branches.csv",
      [
        { header: "Branch ID", select: (r: any) => r.id },
        { header: "Branch Name", select: (r: any) => r.branchName },
        { header: "Branch Manager", select: (r: any) => r.branchManager },
        { header: "Email", select: (r: any) => r.email },
        { header: "Address", select: (r: any) => r.address },
        { header: "Status", select: (r: any) => r.status },
        { header: "Is Active", select: (r: any) => r.isActive },
      ],
      rows as any[]
    );
  });

  listFranchiseTransactions = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await outletService.listTransactionsByFranchise(req.params.id, req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  exportFranchiseTransactions = asyncHandler(async (req: Request, res: Response) => {
    const rows = await outletService.exportTransactionsByFranchise(req.params.id, req.query);
    streamCsv(
      res,
      "franchise-transactions.csv",
      [
        { header: "Transaction ID", select: (r: any) => r.id },
        { header: "Reference Number", select: (r: any) => r.dateAndId?.reference || "" },
        { header: "Customer Name", select: (r: any) => r.customerName || "" },
        { header: "Transaction Type", select: (r: any) => r.transactionType || "" },
        { header: "Transaction Stage", select: (r: any) => r.transactionStage || "" },
        { header: "Workflow Stage", select: (r: any) => r.workflowStage || "" },
        { header: "Transaction Value", select: (r: any) => r.transactionValue ?? "" },
        { header: "Status", select: (r: any) => r.status || "" },
        { header: "Created At", select: (r: any) => (r.dateAndId?.date ? new Date(r.dateAndId.date).toISOString() : "") },
      ],
      rows as any[]
    );
  });

  listBranchTransactions = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await outletService.listTransactionsByBranch(req.params.id, req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  exportBranchTransactions = asyncHandler(async (req: Request, res: Response) => {
    const rows = await outletService.exportTransactionsByBranch(req.params.id, req.query);
    streamCsv(
      res,
      "branch-transactions.csv",
      [
        { header: "Transaction ID", select: (r: any) => r.id },
        { header: "Reference Number", select: (r: any) => r.dateAndId?.reference || "" },
        { header: "Customer Name", select: (r: any) => r.customerName || "" },
        { header: "Transaction Type", select: (r: any) => r.transactionType || "" },
        { header: "Transaction Stage", select: (r: any) => r.transactionStage || "" },
        { header: "Workflow Stage", select: (r: any) => r.workflowStage || "" },
        { header: "Transaction Value", select: (r: any) => r.transactionValue ?? "" },
        { header: "Status", select: (r: any) => r.status || "" },
        { header: "Created At", select: (r: any) => (r.dateAndId?.date ? new Date(r.dateAndId.date).toISOString() : "") },
      ],
      rows as any[]
    );
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

  listNigeriaStates = asyncHandler(async (_req: Request, res: Response) => {
    const states = statesCities.map(item => item.name);
    res.json(successResponse(states));
  });

  listNigeriaCitiesByState = asyncHandler(async (req: Request, res: Response) => {
    const { state } = req.params;
    
    const stateData = statesCities.find(
      (item) => item.name.toLowerCase() === state.toLowerCase()
    );

    if (!stateData) {
      throw new NotFoundError(`State '${state}' not found`);
    }

    res.json(successResponse(stateData.cities));
  });

  updateBranchStatus = asyncHandler(async (req: Request, res: Response) => {
    const { status } = req.body as { status: boolean };

    if (typeof status !== "boolean") {
      throw new ValidationError("status must be a boolean");
    }

    const resolvedStatus: "Active" | "Deactivated" = status ? "Active" : "Deactivated";

    const data = await outletService.updateBranchStatus(req.params.id, resolvedStatus);
    const adminId = (req as any).user?.userId as string;
    await auditTrailService.logAction({
      adminId,
      actionType: "BRANCH_UPDATE",
      actionLabel: "Update branch status",
      resourceType: "BRANCH",
      resourceId: req.params.id,
      metadata: { status: resolvedStatus },
    });
    res.json(successResponse(data));
  });

  updateBranch = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const before = await outletService.getBranch(req.params.id);
    const updated = await outletService.updateBranch(req.params.id, req.body || {});
    await auditTrailService.logAction({
      adminId,
      actionType: "BRANCH_UPDATE",
      actionLabel: "Update branch",
      resourceType: "BRANCH",
      resourceId: req.params.id,
      previousState: before,
      newState: updated,
    });
    res.json(successResponse(updated));
  });

  // exportBranches = asyncHandler(async (_req: Request, res: Response) => {
  //   const data = await outletService.exportBranches();
  //   res.json(successResponse(data));
  // });

  listBranchAgents = asyncHandler(async (req: Request, res: Response) => {
    const data = await outletService.listBranchAgents(req.params.id, req.query);
    res.json(successResponse(data.items, { pagination: data.pagination }));
  });

  exportBranchAgents = asyncHandler(async (req: Request, res: Response) => {
    const rows = await outletService.exportBranchAgents(req.params.id, req.query);
    streamCsv(
      res,
      "branch-agents.csv",
      [
        { header: "Agent ID", select: (r: any) => r.id },
        { header: "Agent Name", select: (r: any) => r.name },
        { header: "Email", select: (r: any) => r.email },
        { header: "Phone Number", select: (r: any) => r.phoneNumber },
        { header: "Active", select: (r: any) => (r.isActive ? "Active" : "Deactivated") },
        { header: "Approved", select: (r: any) => (r.isApproved ? "Approved" : "Pending") },
        { header: "Created At", select: (r: any) => (r.createdAt ? new Date(r.createdAt).toISOString() : "") },
      ],
      rows as any[]
    );
  });

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
