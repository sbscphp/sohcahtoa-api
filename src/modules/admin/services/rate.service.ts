import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { buildRateWhereClause, rateSelectFields, isActiveWhere, isScheduledWhere, isExpiredWhere, isDeactivatedWhere, isPendingApprovalWhere } from "../../../shared/utils/rate-filters";
import { workflowService } from "./workflow.service";
import { ValidationError } from "../../../shared/utils/errors";

const prisma: PrismaClient = getDatabase();

class RateService {

  async stats() {
    const now = new Date();
    const [active, scheduled, expired, deactivated, pendingApproval, all] = await Promise.all([
      prisma.exchangeRate.count({ where: isActiveWhere(now) }),
      prisma.exchangeRate.count({ where: isScheduledWhere(now) }),
      prisma.exchangeRate.count({ where: isExpiredWhere(now) }),
      prisma.exchangeRate.count({ where: isDeactivatedWhere() }),
      prisma.exchangeRate.count({ where: isPendingApprovalWhere() }),
      prisma.exchangeRate.count({}),
    ]);
    return { all, active, scheduled, expired, deactivated, pendingApproval };
  }

  async list(filters: any = {}, page = 1, limit = 20) {
    const where = buildRateWhereClause({
      search: ((filters || {}).search ?? (filters || {}).q) || undefined,
      status: filters.status,
      fromCurrency: filters.fromCurrency,
      toCurrency: filters.toCurrency,
    });

    const skip = (page - 1) * limit;
    const client: any = prisma as any;
    const [total, items] = await Promise.all([
      client.exchangeRate.count({ where }),
      client.exchangeRate.findMany({
        where,
        select: rateSelectFields,
        orderBy: { updatedAt: "desc" },
        skip,
        take: limit,
      }),
    ]);

    const now = new Date();
    const formattedItems = items.map((r: any) => {
      let status: string;
      if (r.isActive === false && r.isApproved === false) {
        status = "PENDING_APPROVAL";
      } else if (r.isActive === false) {
        status = "DEACTIVATED";
      } else if (new Date(r.validFrom) > now) {
        status = "SCHEDULED";
      } else if (new Date(r.validUntil) <= now) {
        status = "EXPIRED";
      } else {
        status = "ACTIVE";
      }

      return {
        ...r,
        status,
        buyRate: Number(r.buyRate || 0),
        sellRate: Number(r.sellRate || 0),
      };
    });

    return { data: formattedItems, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async get(id: string) {
    const client: any = prisma as any;
    return client.exchangeRate.findUnique({ where: { id } });
  }

  async create(data: { fromCurrency: string; toCurrency: string; buyRate: number; sellRate: number; validFrom: Date; validUntil: Date; note?: string }) {
    const now = new Date();
    const client: any = prisma as any;

    const nonExpiredCount = await client.exchangeRate.count({
      where: {
        fromCurrency: data.fromCurrency.toUpperCase(),
        toCurrency: data.toCurrency.toUpperCase(),
        isActive: true,
        validUntil: { gt: now },
      },
    });

    if (nonExpiredCount > 0) {
      throw new ValidationError(
        `Cannot create a new rate for ${data.fromCurrency}/${data.toCurrency}. There are currently active or scheduled rates that have not yet expired.`
      );
    }

    const rate = data.sellRate;
    const created = await client.exchangeRate.create({
      data: {
        fromCurrency: data.fromCurrency,
        toCurrency: data.toCurrency,
        buyRate: data.buyRate as any,
        sellRate: data.sellRate as any,
        rate: rate as any,
        note: data.note,
        validFrom: data.validFrom,
        validUntil: data.validUntil,
        isActive: false, // Inactive until approved
        isApproved: false, // Pending approval
        source: "MANUAL",
      },
    });

    const attached = await workflowService.attachWorkflowToRate(created.id);
    if (!attached) {
      // Auto approve if no workflow template exists for RATE
      const approvedRate = await client.exchangeRate.update({
        where: { id: created.id },
        data: { isApproved: true, isActive: true },
      });
      return approvedRate;
    }

    return created;
  }

  async update(id: string, data: Partial<{ buyRate: number; sellRate: number; validFrom: Date; validUntil: Date; isActive: boolean }>) {
    const patch: any = {};
    if (typeof data.buyRate === "number") patch.buyRate = data.buyRate as any;
    if (typeof data.sellRate === "number") {
      patch.sellRate = data.sellRate as any;
      patch.rate = data.sellRate as any;
    }
    if (data.validFrom instanceof Date) patch.validFrom = data.validFrom;
    if (data.validUntil instanceof Date) patch.validUntil = data.validUntil;
    if (typeof data.isActive === "boolean") patch.isActive = data.isActive;
    const client: any = prisma as any;
    return client.exchangeRate.update({ where: { id }, data: patch });
  }

  async deactivate(id: string) {
    const client: any = prisma as any;
    return client.exchangeRate.update({ where: { id }, data: { isActive: false } });
  }

  async export(filters: any = {}) {
    const where = buildRateWhereClause({
      search: ((filters || {}).search ?? (filters || {}).q) || undefined,
      status: filters.status,
      fromCurrency: filters.fromCurrency,
      toCurrency: filters.toCurrency,
    });
    const client: any = prisma as any;
    const items = await client.exchangeRate.findMany({
      where,
      orderBy: { updatedAt: "desc" },
      take: 10_000,
      select: {
        id: true,
        fromCurrency: true,
        toCurrency: true,
        buyRate: true,
        sellRate: true,
        validFrom: true,
        updatedAt: true,
      },
    });
    return (items || []).map((r: any) => ({
      dateTime: r.validFrom,
      currencyPair: `${r.fromCurrency}-${r.toCurrency}`,
      weBuyAt: Number(r.buyRate || 0),
      weSellAt: Number(r.sellRate || 0),
      lastUpdated: r.updatedAt,
    }));
  }

  async approveRate(rateId: string, adminId: string, reason?: string) {
    const client: any = prisma as any;
    const rate = await client.exchangeRate.findUnique({
      where: { id: rateId },
      select: {
        id: true,
        workflowTemplateId: true,
        currentWorkflowStageId: true,
        isApproved: true,
      }
    });

    if (!rate) throw new Error("Rate not found");
    if (rate.isApproved) throw new Error("Rate is already approved");

    if (rate.workflowTemplateId && rate.currentWorkflowStageId) {
      const workflow = await client.workflowTemplate.findUnique({
        where: { id: rate.workflowTemplateId },
        include: {
          stages: {
            orderBy: { order: "asc" },
            include: { assignees: true }
          }
        }
      });

      if (workflow) {
        const currentStageIndex = workflow.stages.findIndex((s: any) => s.id === rate.currentWorkflowStageId);
        if (currentStageIndex === -1) {
          throw new Error("Rate is in an invalid workflow stage.");
        }

        const currentStage = workflow.stages[currentStageIndex];
        const isAssigned = currentStage.assignees.some((a: any) => String(a.adminId) === String(adminId));
        if (!isAssigned) {
          throw new Error("You are not authorized to approve this rate at its current stage.");
        }

        if (currentStageIndex + 1 < workflow.stages.length) {
          const nextStage = workflow.stages[currentStageIndex + 1];
          await client.exchangeRate.update({
            where: { id: rateId },
            data: { currentWorkflowStageId: nextStage.id }
          });
          return { message: "Rate advanced to the next approval stage" };
        }
      }
    }

    // Final approval
    await client.exchangeRate.update({
      where: { id: rateId },
      data: {
        isApproved: true,
        isActive: true,
        currentWorkflowStageId: null,
      }
    });

    return { message: "Rate approved and activated successfully" };
  }

  async rejectRate(rateId: string, adminId: string, reason: string) {
    const client: any = prisma as any;
    const rate = await client.exchangeRate.findUnique({
      where: { id: rateId },
      select: {
        id: true,
        workflowTemplateId: true,
        currentWorkflowStageId: true,
        isApproved: true,
      }
    });

    if (!rate) throw new Error("Rate not found");
    if (rate.isApproved) throw new Error("Rate is already approved");

    if (rate.workflowTemplateId && rate.currentWorkflowStageId) {
      const workflow = await client.workflowTemplate.findUnique({
        where: { id: rate.workflowTemplateId },
        include: { stages: { include: { assignees: true } } }
      });

      if (workflow) {
        const currentStage = workflow.stages.find((s: any) => s.id === rate.currentWorkflowStageId);
        if (currentStage) {
          const isAssigned = currentStage.assignees.some((a: any) => String(a.adminId) === String(adminId));
          if (!isAssigned) {
            throw new Error("You are not authorized to reject this rate at its current stage.");
          }
        }
      }
    }

    await client.exchangeRate.update({
      where: { id: rateId },
      data: {
        isActive: false,
        isApproved: false,
        currentWorkflowStageId: null,
      }
    });

    return { message: "Rate rejected successfully" };
  }
}

export const rateService = new RateService();
