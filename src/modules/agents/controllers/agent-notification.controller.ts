import { Response, NextFunction } from "express";
import agentNotificationService from "../services/agent-notification.service";
import agentNotificationPreferenceService from "../services/agent-notification-preference.service";
import { UpdateAgentNotificationPreferencesSchema } from "../dto/agent-notification-preference.dto";
import { successResponse, ValidationError } from "../../../shared/utils";
import { AuthRequest } from "../../../shared/middleware";

class AgentNotificationController {
  async listNotifications(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const page = parseInt((req.query.page as string) || "1", 10) || 1;
      const limit = parseInt((req.query.limit as string) || "20", 10) || 20;
      const notificationType = req.query.notification_type as string | undefined;

      const result = await agentNotificationService.listAgentNotifications(
        authUser.userId,
        page,
        limit,
        notificationType,
      );

      res.json(successResponse(result.data, { pagination: result.meta }));
    } catch (error) {
      next(error);
    }
  }

  async markNotificationRead(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const notificationId = req.params.id as string;
      if (!notificationId) {
        throw new ValidationError("Notification id is required");
      }

      const result = await agentNotificationService.markNotificationRead(authUser.userId, notificationId);

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async getNotificationPreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const data = await agentNotificationPreferenceService.getAgentNotificationPreferences(
        authUser.userId,
      );

      res.json(successResponse(data));
    } catch (error) {
      next(error);
    }
  }

  async updateNotificationPreferences(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const parsed = UpdateAgentNotificationPreferencesSchema.safeParse(req.body);
      if (!parsed.success) {
        const msg =
          parsed.error.flatten().formErrors.join("; ") ||
          parsed.error.issues.map((issue) => issue.message).join("; ") ||
          "Invalid request body";
        throw new ValidationError(msg);
      }

      const data = await agentNotificationPreferenceService.updateAgentNotificationPreferences(
        authUser.userId,
        parsed.data,
      );

      res.json(successResponse(data));
    } catch (error) {
      next(error);
    }
  }
}

const agentNotificationController = new AgentNotificationController();
export default agentNotificationController;
