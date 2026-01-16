import prisma from "../config/database";
import customerClient from "../clients/customer.client";
import { NotFoundError, ValidationError } from "@fx-platform/shared-utils";

type CreateCustomerFlagPayload = {
  type: string; // should align with AmlFlagType
  severity: string; // should align with AmlFlagSeverity
  title?: string;
  description: string;
  details?: any;
};

type UpdateFlagStatusPayload = {
  status: "OPEN" | "UNDER_REVIEW" | "RESOLVED" | "DISMISSED";
  resolutionNotes?: string;
};

export class CustomerService {
  // --------------------
  // Read-only customer view
  // --------------------
  async listCustomers(page = 1, limit = 20, q?: string) {
    // pass-through to customer-service
    return customerClient.listCustomers({ page, limit, q });
  }

  async getCustomer(userId: string) {
    return customerClient.getCustomerById(userId);
  }

  // --------------------
  // Flags (stored in admin-service DB)
  // --------------------
  async createFlag(userId: string, adminId: string, payload: CreateCustomerFlagPayload) {
    if (!payload.description || payload.description.trim().length < 2) {
      throw new ValidationError("description is required");
    }

    // Store locally in admin-service DB
    const flag = await prisma.customerFlag.create({
      data: {
        userId,
        type: payload.type as any,
        severity: payload.severity as any,
        title: payload.title,
        description: payload.description,
        details: payload.details,
        createdBy: adminId,
      },
    });

    return flag;
  }

  async listCustomerFlags(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      prisma.customerFlag.findMany({
        where: { userId },
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customerFlag.count({ where: { userId } }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listAllFlags(filters: any, page = 1, limit = 50) {
    const skip = (page - 1) * limit;

    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.type) where.type = filters.type;
    if (filters.severity) where.severity = filters.severity;
    if (filters.userId) where.userId = filters.userId;

    const [data, total] = await Promise.all([
      prisma.customerFlag.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
      }),
      prisma.customerFlag.count({ where }),
    ]);

    return {
      data,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async updateFlagStatus(flagId: string, adminId: string, payload: UpdateFlagStatusPayload) {
    const flag = await prisma.customerFlag.findUnique({ where: { id: flagId } });
    if (!flag) throw new NotFoundError("Flag not found");

    const data: any = {
      status: payload.status,
      updatedAt: new Date(),
    };

    if (payload.status === "RESOLVED" || payload.status === "DISMISSED") {
      data.resolvedAt = new Date();
      data.resolvedBy = adminId;
      data.resolutionNotes = payload.resolutionNotes;
    } else {
      // If re-opening, clear resolution fields
      data.resolvedAt = null;
      data.resolvedBy = null;
      data.resolutionNotes = null;
    }

    return prisma.customerFlag.update({
      where: { id: flagId },
      data,
    });
  }
}

export default new CustomerService();
