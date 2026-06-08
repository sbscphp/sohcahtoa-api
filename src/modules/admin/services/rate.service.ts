import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { buildRateWhereClause, rateSelectFields, isActiveWhere, isScheduledWhere, isExpiredWhere, isDeactivatedWhere, isPendingApprovalWhere, isRejectedWhere } from "../../../shared/utils/rate-filters";
import { workflowService } from "./workflow.service";
import { DuplicateError, ValidationError, NotFoundError } from "../../../shared/utils/errors";
import { expireExpiredRates } from "../../../shared/utils/rate-expiry";


const prisma: PrismaClient = getDatabase();

class RateService {

  async stats() {
    await expireExpiredRates();
    const now = new Date();
    const [active, scheduled, expired, deactivated, pendingApproval, rejected, all] = await Promise.all([
      prisma.exchangeRate.count({ where: isActiveWhere(now) }),
      prisma.exchangeRate.count({ where: isScheduledWhere(now) }),
      prisma.exchangeRate.count({ where: isExpiredWhere(now) }),
      prisma.exchangeRate.count({ where: isDeactivatedWhere(now) }),
      prisma.exchangeRate.count({ where: isPendingApprovalWhere(now) }),
      prisma.exchangeRate.count({ where: isRejectedWhere(now) }),
      prisma.exchangeRate.count({}),
    ]);
    return {
      all,
      active,
      scheduled,
      expired,
      deactivated,
      pendingApproval,
      rejected,
    };
  }

  async list(filters: any = {}, page = 1, limit = 20) {
    await expireExpiredRates();
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
    const formattedItems = items.map((r: any) => this.formatRate(r, now));

    return { data: formattedItems, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  formatRate(r: any, now = new Date()) {
    let status = "DEACTIVATED";
    if (new Date(r.validUntil) <= now) {
      status = "EXPIRED";
    } else if (!r.isApproved) {
      if (r.currentWorkflowStageId === null) {
        status = "REJECTED";
      } else {
        status = "PENDING_APPROVAL";
      }
    } else if (r.isActive !== false) {
      if (new Date(r.validFrom) > now) {
        status = "SCHEDULED";
      } else {
        status = "ACTIVE";
      }
    }

    return {
      ...r,
      status,
      buyRate: Number(r.buyRate || 0),
      sellRate: Number(r.sellRate || 0),
    };
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
      throw new DuplicateError(
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

    return attached;
  }

  async update(id: string, data: Partial<{ buyRate: number; sellRate: number; validFrom: Date; validUntil: Date; isActive: boolean }>) {
    const patch: any = {};
    let isCoreEdit = false;

    if (typeof data.buyRate === "number") {
      patch.buyRate = data.buyRate as any;
      isCoreEdit = true;
    }
    if (typeof data.sellRate === "number") {
      patch.sellRate = data.sellRate as any;
      patch.rate = data.sellRate as any;
      isCoreEdit = true;
    }
    if (data.validFrom instanceof Date) {
      patch.validFrom = data.validFrom;
      isCoreEdit = true;
    }
    if (data.validUntil instanceof Date) {
      patch.validUntil = data.validUntil;
      isCoreEdit = true;
    }
    if (typeof data.isActive === "boolean") patch.isActive = data.isActive;

    if (isCoreEdit) {
      patch.isApproved = false;
      patch.isActive = false;
      patch.workflowTemplateId = null;
      patch.currentWorkflowStageId = null;
    }

    const client: any = prisma as any;
    const updated = await client.exchangeRate.update({ where: { id }, data: patch });

    if (isCoreEdit) {
      const attached = await workflowService.attachWorkflowToRate(id);
      if (!attached) {
        // Auto approve if no workflow template exists for RATE
        const approvedRate = await client.exchangeRate.update({
          where: { id },
          data: { isApproved: true, isActive: true },
        });
        return approvedRate;
      }
      return attached;
    }

    return updated;
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
        fromCurrency: true,
        toCurrency: true,
        workflowTemplateId: true,
        currentWorkflowStageId: true,
        isApproved: true,
      }
    });

    if (!rate) throw new Error("Rate not found");
    if (rate.isApproved) throw new Error("Rate is already approved");

    const now = new Date();
    const existingActiveRate = await client.exchangeRate.findFirst({
      where: {
        fromCurrency: rate.fromCurrency,
        toCurrency: rate.toCurrency,
        isActive: true,
        validUntil: { gt: now },
        id: { not: rate.id },
      },
    });

    if (existingActiveRate) {
      throw new ValidationError(
        `Cannot approve rate. There is already an active or scheduled rate for ${rate.fromCurrency}/${rate.toCurrency} that has not yet expired.`
      );
    }

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

  async deleteRate(id: string) {
    await expireExpiredRates();
    const client: any = prisma as any;
    const rate = await client.exchangeRate.findUnique({
      where: { id },
      select: { id: true, isActive: true },
    });

    if (!rate) {
      throw new NotFoundError("Rate not found");
    }

    if (rate.isActive) {
      throw new ValidationError("you cannot delete an active rate");
    }

    await client.exchangeRate.delete({ where: { id } });

    return { message: "Rate deleted successfully" };
  }

  async getWorkflowLine(rateId: string) {
    const client: any = prisma as any;
    const actions = await client.adminAction.findMany({
      where: {
        resourceType: "RATE",
        resourceId: rateId,
      },
      include: {
        admin: {
          select: {
            id: true,
            fullName: true,
            position: true,
            role: { select: { name: true } },
          },
        },
      },
      orderBy: { performedAt: "asc" },
    });

    const toTitle = (label: string, type: string) => {
      const upLabel = (label || "").toUpperCase();
      const upType = (type || "").toUpperCase();
      if (upLabel.includes("CREATE") || upType.includes("CREATE")) return "Rate Created";
      if (upLabel.includes("DEACTIVATE") || upType.includes("DEACTIVATE")) return "Rate Deactivated";
      if (upLabel.includes("REJECT") || upType.includes("REJECT")) return "Rate Rejected";
      if (upLabel.includes("ADVANCED") || upLabel.includes("STAGE")) return "Rate Advanced";
      if (upLabel.includes("APPROV") || upType.includes("APPROV")) return "Rate Approved";
      if (upLabel.includes("DELETE") || upLabel.includes("DELET")) return "Rate Deleted";
      if (upLabel.includes("UPDATE") || upType.includes("UPDATE") || upLabel.includes("EDIT")) return "Rate Updated";
      return label || type;
    };

    const toOutcome = (label: string, type: string) => {
      const upLabel = (label || "").toUpperCase();
      const upType = (type || "").toUpperCase();
      if (upLabel.includes("CREATE") || upType.includes("CREATE")) return "Created";
      if (upLabel.includes("DEACTIVATE") || upType.includes("DEACTIVATE")) return "Deactivated";
      if (upLabel.includes("REJECT") || upType.includes("REJECT")) return "Rejected";
      if (upLabel.includes("ADVANCED") || upLabel.includes("STAGE")) return "Advanced";
      if (upLabel.includes("APPROV") || upType.includes("APPROV")) return "Approved";
      if (upLabel.includes("DELETE") || upLabel.includes("DELET")) return "Deleted";
      if (upLabel.includes("UPDATE") || upType.includes("UPDATE") || upLabel.includes("EDIT")) return "Updated";
      return "Action Taken";
    };

    return actions.map((a: any) => {
      const adminId = a.adminId;
      const admin = a.admin;
      return {
        id: a.id,
        timestamp: a.performedAt,
        adminId,
        adminName: admin?.fullName || adminId,
        adminRole: admin?.position || admin?.role?.name || null,
        title: toTitle(a.actionLabel || "", a.actionType || ""),
        outcome: toOutcome(a.actionLabel || "", a.actionType || ""),
        comment: a.reason || null,
        action: a.actionType,
      };
    });
  }
}

export const rateService = new RateService();

