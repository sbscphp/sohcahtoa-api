import { Request, Response, NextFunction } from "express";
import agentCustomerService from "../services/agent-customer.service";
import { successResponse, ValidationError } from "../../../shared/utils";
import { AuthRequest } from "../../../shared/middleware";
import {
  AgentCreateNigerianCustomerAccountRequest,
  AgentCustomerListFilters,
  AgentUpdateCustomerRequest,
} from "../../../shared/types";

class AgentCustomerController {
  async createCustomerAccount(req: AuthRequest, res: Response, next: NextFunction) {
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

  async getCustomerStats(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const result = await agentCustomerService.getCustomerStats(authUser.userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async getAgentCustomerDetails(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const userId = req.params.userId as string;
      if (!userId) {
        throw new ValidationError("Customer userId is required");
      }

      const result = await agentCustomerService.getAgentCustomerDetails(authUser.userId, userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }

  async listCustomerTransactions(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const userId = req.params.userId as string;
      if (!userId) {
        throw new ValidationError("Customer userId is required");
      }

      const page = parseInt((req.query.page as string) || "1", 10) || 1;
      const limit = parseInt((req.query.limit as string) || "20", 10) || 20;

      const result = await agentCustomerService.listCustomerTransactions(
        authUser.userId,
        userId,
        page,
        limit
      );
      res.json(successResponse(result.data, { pagination: result.pagination }));
    } catch (error) {
      next(error);
    }
  }

  async updateAgentCustomer(req: AuthRequest, res: Response, next: NextFunction) {
    try {
      const authUser = req.user;
      if (!authUser) {
        throw new ValidationError("Authentication required");
      }

      const userId = req.params.userId as string;
      if (!userId) {
        throw new ValidationError("Customer userId is required");
      }

      const { firstName, lastName, phoneNumber } = req.body as AgentUpdateCustomerRequest;

      const payload: AgentUpdateCustomerRequest = {
        firstName,
        lastName,
        phoneNumber,
      };

      const result = await agentCustomerService.updateAgentCustomerDetails(
        authUser.userId,
        userId,
        payload,
      );

      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  }
}

const agentCustomerController = new AgentCustomerController();
export default agentCustomerController;

