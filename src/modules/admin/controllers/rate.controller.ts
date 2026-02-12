import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse } from "../../../shared/utils";
import { rateService } from "../services/rate.service";
import { auditTrailService } from "../services/audit-trail.service";
import { AuthRequest } from "../../../shared/middleware/auth";

class RateController {
  stats = asyncHandler(async (_req: Request, res: Response) => {
    const result = await rateService.stats();
    res.json(successResponse(result));
  });

  list = asyncHandler(async (req: Request, res: Response) => {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await rateService.list(req.query, page, limit);
    res.json(successResponse(result.data, { pagination: result.meta }));
  });

  get = asyncHandler(async (req: Request, res: Response) => {
    const item = await rateService.get(req.params.id);
    res.json(successResponse(item));
  });

  create = asyncHandler(async (req: AuthRequest, res: Response) => {
    const payload = {
      fromCurrency: req.body.fromCurrency,
      toCurrency: req.body.toCurrency,
      buyRate: parseFloat(req.body.buyRate),
      sellRate: parseFloat(req.body.sellRate),
      validFrom: new Date(req.body.validFrom),
      validUntil: new Date(req.body.validUntil),
    };
    const created = await rateService.create(payload);
    if (req.user) {
      await auditTrailService.logAction({
        adminId: req.user.userId,
        actionType: "RATE_CREATE",
        actionLabel: "Created rates",
        resourceType: "RATE",
        resourceId: created.id,
        newState: created,
        status: "SUCCESS",
        userAgent: req.headers["user-agent"] as string,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip,
      });
    }
    res.status(201).json(successResponse(created));
  });

  update = asyncHandler(async (req: AuthRequest, res: Response) => {
    const patch: any = {};
    if (req.body.buyRate !== undefined) patch.buyRate = parseFloat(req.body.buyRate);
    if (req.body.sellRate !== undefined) patch.sellRate = parseFloat(req.body.sellRate);
    if (req.body.validFrom) patch.validFrom = new Date(req.body.validFrom);
    if (req.body.validUntil) patch.validUntil = new Date(req.body.validUntil);
    if (req.body.isActive !== undefined) patch.isActive = !!req.body.isActive;
    const before = await rateService.get(req.params.id);
    const updated = await rateService.update(req.params.id, patch);
    if (req.user) {
      await auditTrailService.logAction({
        adminId: req.user.userId,
        actionType: "RATE_UPDATE",
        actionLabel: "Rate updated",
        resourceType: "RATE",
        resourceId: updated.id,
        previousState: before,
        newState: updated,
        status: "SUCCESS",
        userAgent: req.headers["user-agent"] as string,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip,
      });
    }
    res.json(successResponse(updated));
  });

  deactivate = asyncHandler(async (req: AuthRequest, res: Response) => {
    const before = await rateService.get(req.params.id);
    const updated = await rateService.deactivate(req.params.id);
    if (req.user) {
      await auditTrailService.logAction({
        adminId: req.user.userId,
        actionType: "RATE_DEACTIVATE",
        actionLabel: "Rate deactivated",
        resourceType: "RATE",
        resourceId: updated.id,
        previousState: before,
        newState: updated,
        status: "SUCCESS",
        userAgent: req.headers["user-agent"] as string,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.ip,
      });
    }
    res.json(successResponse(updated));
  });

  export = asyncHandler(async (req: Request, res: Response) => {
    const result = await rateService.export(req.query);
    res.json(successResponse(result));
  });
}

export const rateController = new RateController();
