import { Request, Response, NextFunction } from "express";
import customerService from "../services/customer.service";
import { successResponse, paginatedResponse } from "../../../shared/utils";
import { streamCsv } from "../../../shared/utils";
import { adminTransactionsService } from "../services/admin-transactions.service";

class CustomerController {
  // Read-only views
  listCustomers = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const q = (req.query.search as string) || undefined;

      const result = await customerService.listCustomers(page, limit, q);
      res.json(successResponse(result.data, { pagination: result.meta }));
    } catch (error) {
      next(error);
    }
  };

  getCustomerCounts = async (_req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await customerService.getCustomerCounts();
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const result = await customerService.getCustomer(req.params.userId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  // Flags
  createFlag = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user?.userId as string;
      const result = await customerService.createFlag(req.params.userId, adminId, req.body);
      res.status(201).json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  listCustomerFlags = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const result = await customerService.listCustomerFlags(req.params.userId, page, limit);
      res.json(paginatedResponse(result.data, page, limit, result.pagination.total));
    } catch (error) {
      next(error);
    }
  };

  listAllFlags = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 50;

      const result = await customerService.listAllFlags(req.query, page, limit);
      res.json(paginatedResponse(result.data, page, limit, result.pagination.total));
    } catch (error) {
      next(error);
    }
  };

  updateFlagStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user?.userId as string;
      const result = await customerService.updateFlagStatus(req.params.flagId, adminId, req.body);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  deactivateCustomer = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const adminId = (req as any).user?.userId as string;
      const result = await customerService.deactivateCustomer(req.params.userId, adminId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  toggleActiveStatus = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const isActiveRaw = (req.body?.isActive ?? req.query?.isActive) as any;
      const isActive = typeof isActiveRaw === "boolean" ? isActiveRaw : String(isActiveRaw) === "true";
      const adminId = (req as any).user?.userId as string;
      const result = await customerService.toggleCustomerActive(userId, isActive, adminId);
      res.json(successResponse(result));
    } catch (error) {
      next(error);
    }
  };

  getCustomerTransactions = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { userId } = req.params;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const result = await adminTransactionsService.listTransactions({ ...req.query, userId }, page, limit);
      res.json(successResponse(result.data, { pagination: result.meta }));
    } catch (error) {
      next(error);
    }
  };

  exportCustomersCsv = async (req: Request, res: Response, next: NextFunction) => {
    try {
      const rows = await customerService.exportCustomers({
        search: (req.query.search as string) || (req.query.q as string) || "",
        status: (req.query.status as string) || undefined,
      });
      streamCsv(
        res,
        "customers.csv",
        [
          { header: "Customer", select: (r: any) => {
            const name = r.name || "";
            const id = r.id || "";
            return id ? `${name}\nID:${id}` : name;
          }},
          { header: "Contact", select: (r: any) => {
            const phone = r.phoneNumber || "";
            const email = r.email || "";
            return [phone, email].filter(Boolean).join(" ");
          }},
          { header: "Date joined", select: (r: any) => r.dateJoined },
          { header: "Total Transactions", select: (r: any) => r.totalTransactions },
          { header: "Transaction Volume", select: (r: any) => r.transactionVolume },
          { header: "Status", select: (r: any) => r.status },
        ],
        rows as any[]
      );
    } catch (error) {
      next(error);
    }
  };
}

export default new CustomerController();
