import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { ticketsService } from "../services/tickets.service";
import { uploadFile } from "../../../shared/utils/file-upload";

class TicketsController {
  stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await ticketsService.getStats();
    res.json(successResponse(result));
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await ticketsService.list(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const ticket = await ticketsService.get(req.params.id);
    res.json(successResponse(ticket));
  });

  create = asyncHandler(async (req: Request, res: Response) => {
    let attachment;
    if (req.file) {
      attachment = await uploadFile(req.file, { folder: "tickets" });
    }
    const payload = {
      customer: req.body.customer,
      caseType: req.body.caseType,
      priorityLevel: req.body.priorityLevel,
      description: req.body.description,
      attachment,
    };
    const created = await ticketsService.create(payload);
    res.status(201).json(successResponse(created));
  });

  updateStatus = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const updated = await ticketsService.updateStatus(req.params.id, req.body.status, req.body?.notes, adminId);
    res.json(successResponse(updated));
  });

  assign = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const updated = await ticketsService.assignAgent(req.params.id, adminId);
    res.json(successResponse(updated));
  });

  comment = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    const comment = await ticketsService.addComment(req.params.id, adminId, req.body.message);
    res.status(201).json(successResponse(comment));
  });
}

export const ticketsController = new TicketsController();
