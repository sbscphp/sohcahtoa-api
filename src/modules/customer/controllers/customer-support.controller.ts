import { Request, Response, NextFunction } from "express";
import customerSupportService from "../services/customer-support.service";
import { successResponse, paginatedResponse } from "../../../shared/utils";
import { AuthRequest } from "../../../shared/middleware";

class CustomerSupportController {
  /**
   * Create a new support ticket
   */
  createTicket = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const customerId = req.user?.userId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const { category, description } = req.body;
      const file = req.file;

      if (!category) {
        res.status(400).json({
          success: false,
          message: "Category is required",
        });
        return;
      }

      if (!description) {
        res.status(400).json({
          success: false,
          message: "Description is required",
        });
        return;
      }

      const result = await customerSupportService.createSupportTicket({
        customerId,
        category,
        description,
        file,
      });

      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get customer's support tickets (paginated and filterable)
   */
  getMyTickets = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const customerId = req.user?.userId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 10, 50);

      const filters = {
        status: req.query.status as string | undefined,
        category: req.query.category as string | undefined,
        search: req.query.search as string | undefined,
      };

      const result = await customerSupportService.getCustomerTickets(
        customerId,
        filters,
        page,
        limit
      );

      res.json(paginatedResponse(result.data, page, limit, result.pagination.total));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get ticket details by ID
   */
  getTicketDetails = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const customerId = req.user?.userId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const { ticketId } = req.params;

      const result = await customerSupportService.getTicketDetails(ticketId, customerId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  /**
   * Get ticket by reference number
   */
  getTicketByReference = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      const customerId = req.user?.userId;

      if (!customerId) {
        res.status(401).json({
          success: false,
          message: "Authentication required",
        });
        return;
      }

      const { reference } = req.params;

      const result = await customerSupportService.getTicketByReference(reference, customerId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };
}

export default new CustomerSupportController();
