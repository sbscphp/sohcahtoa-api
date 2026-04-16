import { Request, Response } from "express";
import { asyncHandler } from "../../../shared/middleware";
import { successResponse, ValidationError } from "../../../shared/utils";
import notificationService from "../../notifications/services/notification.service";

class AdminNotificationController {
  listAll = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    if (!adminId) {
      throw new ValidationError("Authentication required");
    }

    const pageRaw = parseInt(req.query.page as string) || 1;
    const limitRaw = parseInt(req.query.limit as string) || 20;

    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;

    const offset = (page - 1) * limit;
    const result = await notificationService.getInAppNotifications(adminId, { limit, offset, unreadOnly: false });

    res.json(
      successResponse(result.notifications, {
        pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
      })
    );
  });

  listUnread = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    if (!adminId) {
      throw new ValidationError("Authentication required");
    }

    const pageRaw = parseInt(req.query.page as string) || 1;
    const limitRaw = parseInt(req.query.limit as string) || 20;

    const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
    const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 100) : 20;

    const offset = (page - 1) * limit;
    const result = await notificationService.getInAppNotifications(adminId, { limit, offset, unreadOnly: true });

    res.json(
      successResponse(result.notifications, {
        pagination: { page, limit, total: result.total, totalPages: Math.ceil(result.total / limit) },
      })
    );
  });

  markAsRead = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    if (!adminId) {
      throw new ValidationError("Authentication required");
    }

    const notificationId = (req.params.id || "").toString().trim();
    if (!notificationId) {
      throw new ValidationError("notificationId is required");
    }

    const updated = await notificationService.markAsRead(notificationId, adminId);
    res.json(successResponse(updated));
  });

  getUnreadCount = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    if (!adminId) {
      throw new ValidationError("Authentication required");
    }

    const count = await notificationService.getUnreadCount(adminId);
    res.json(successResponse({ count }));
  });

  markAllAsRead = asyncHandler(async (req: Request, res: Response) => {
    const adminId = (req as any).user?.userId as string;
    if (!adminId) {
      throw new ValidationError("Authentication required");
    }

    const result = await notificationService.markAllAsRead(adminId);
    res.json(successResponse({ count: result.count }));
  });
}

export const adminNotificationController = new AdminNotificationController();
