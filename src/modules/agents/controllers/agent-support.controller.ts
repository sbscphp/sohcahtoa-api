import { Response, NextFunction } from "express";
import { paginatedResponse, successResponse, ValidationError } from "../../../shared/utils";
import { AuthRequest } from "../../../shared/middleware";
import agentSupportService from "../services/agent-support.service";

class AgentSupportController {
  async createTicket(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const { customerId, category, description } = req.body as {
        customerId?: string;
        category?: string;
        description?: string;
      };

      if (!customerId) {
        throw new ValidationError("customerId is required");
      }
      if (!category) {
        throw new ValidationError("category is required");
      }
      if (!description) {
        throw new ValidationError("description is required");
      }

      const file = req.file as Express.Multer.File | undefined;

      const result = await agentSupportService.createSupportTicket({
        agentUserId: authUser.userId,
        customerId,
        category,
        description,
        file,
      });

      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a paginated list of tickets created by the authenticated agent.
   */
  async listTickets(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const page = Math.max(1, parseInt((req.query.page as string) || "1", 10) || 1);
      const limit = Math.min(
        50,
        Math.max(1, parseInt((req.query.limit as string) || "10", 10) || 10)
      );

      const result = await agentSupportService.listAgentSupportTickets(authUser.userId, page, limit);

      res.json(paginatedResponse(result.data, page, limit, result.pagination.total));
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get detailed ticket information for a ticket created by the authenticated agent.
   */
  async getTicketDetails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const ticketId = req.params.ticketId as string | undefined;
      if (!ticketId) {
        throw new ValidationError("ticketId is required");
      }

      const result = await agentSupportService.getAgentSupportTicketDetails(
        authUser.userId,
        ticketId
      );

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }
}

const agentSupportController = new AgentSupportController();
export default agentSupportController;

