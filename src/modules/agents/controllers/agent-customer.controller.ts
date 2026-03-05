import { Request, Response, NextFunction } from "express";
import agentCustomerService from "../services/agent-customer.service";
import { successResponse, ValidationError } from "../../../shared/utils";
import { AuthRequest } from "../../../shared/middleware";
import {
  AgentCreateNigerianCustomerAccountRequest,
  AgentCustomerListFilters,
} from "../../../shared/types";

class AgentCustomerController {
  async createNigerianCustomerAccount(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const data: AgentCreateNigerianCustomerAccountRequest = req.body;

      const result = await agentCustomerService.createNigerianCustomerAccountForAgent(
        data,
        authUser.userId,
      );

      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async listAgentCustomers(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const page = parseInt((req.query.page as string) || "1", 10) || 1;
      const limit = parseInt((req.query.limit as string) || "20", 10) || 20;

      const filters: AgentCustomerListFilters = {
        status: req.query.status as string | undefined,
        lastTransactionType: req.query.lastTransactionType as string | undefined,
        customerType: req.query.customerType as string | undefined,
        fromDate: req.query.fromDate as string | undefined,
        toDate: req.query.toDate as string | undefined,
        search: req.query.search as string | undefined,
      };

      const result = await agentCustomerService.listAgentCustomers(authUser.userId, filters, page, limit);

      res.json(successResponse(result.data, { pagination: result.meta }));
    } catch (error) {
      next(error);
    }
  }
}

const agentCustomerController = new AgentCustomerController();
export default agentCustomerController;

