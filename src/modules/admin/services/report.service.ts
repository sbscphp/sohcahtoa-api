import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";

const prisma: PrismaClient = getDatabase();

class ReportService {
  async modules() {
    return [
      { key: "OUTLET", name: "Outlets management", description: "Monitor outlet-related actions with supporting reports." },
      { key: "RATE", name: "Rate Management", description: "Reports on rate creation, updates, and variances." },
      { key: "TRANSACTION", name: "Transaction management", description: "Reports on customer transactions and flags." },
      { key: "WORKFLOW", name: "Workflow management", description: "Reports on workflow executions and escalations." },
      { key: "AGENT", name: "Agents management", description: "Monitor agent activities with supporting reports." },
      { key: "FRANCHISE", name: "Franchise management", description: "Reports on franchise onboarding and status." },
      { key: "BRANCH", name: "Branch management", description: "Reports on branch set-up, performance & incidents." },
      { key: "INCIDENT", name: "Incidence management", description: "Reports on incidents and resolutions." },
    ];
  }

  async stats() {
    const client: any = prisma as any;
    const [all, pending] = await Promise.all([
      client.reportJob.count(),
      client.reportJob.count({ where: { status: "PENDING" } }),
    ]);
    return { all, pending };
  }

  async list(filters: any = {}, page = 1, limit = 20) {
    const where: any = {};
    if (filters.module) where.module = filters.module;
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }
    const skip = (page - 1) * limit;
    const client: any = prisma as any;
    const [total, items] = await Promise.all([
      client.reportJob.count({ where }),
      client.reportJob.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
    ]);
    return { data: items, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async get(id: string) {
    const client: any = prisma as any;
    return client.reportJob.findUnique({ where: { id } });
  }

  async generate(data: { module: string; startDate: Date; endDate: Date; format: "CSV" | "PDF"; requestedBy: string }) {
    const client: any = prisma as any;
    const job = await client.reportJob.create({
      data: {
        module: data.module,
        format: data.format,
        startDate: data.startDate,
        endDate: data.endDate,
        requestedBy: data.requestedBy,
        status: "SUCCESS",
        generatedUrl: `/exports/${data.module.toLowerCase()}-${Date.now()}.${data.format.toLowerCase()}`,
        metadata: {},
        completedAt: new Date(),
      },
    });
    return job;
  }
}

export const reportService = new ReportService();
