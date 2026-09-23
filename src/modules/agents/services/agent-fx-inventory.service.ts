import { getDatabase } from "../../../config/database";
import { ValidationError, createLogger, generateTransactionReference } from "../../../shared/utils";
import { eventBus, EventTypes } from "../../../events/event-bus";
import { UserRole } from "../../../shared/types";

const prisma: any = getDatabase();
const logger = createLogger("AgentFxInventoryService");

class AgentFxInventoryService {
  private async resolveAgent(agentUserId: string) {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId }, select: { id: true, email: true, role: true } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can use FX Inventory");
    }
    const agent = await prisma.agent.findUnique({ where: { email: agentUser.email } });
    if (!agent) throw new ValidationError("Agent profile not found");
    return agent;
  }

  async getMyCashBalances(agentUserId: string) {
    const agent = await this.resolveAgent(agentUserId);
    const rows = await prisma.agentCashBalance.findMany({ where: { agentId: agent.id }, orderBy: { currency: "asc" } });
    return rows.map((r: any) => ({ currency: r.currency, balance: Number(r.balance), updatedAt: r.updatedAt }));
  }

  async lodgeCash(agentUserId: string, payload: { currency: string; amount: number; notes?: string }) {
    const agent = await this.resolveAgent(agentUserId);
    if (!agent.branchId) {
      throw new ValidationError("Agent must be assigned to a branch to use FX Inventory");
    }

    const amount = Number(payload.amount);
    if (!amount || isNaN(amount) || amount <= 0) {
      throw new ValidationError("amount must be a positive number");
    }
    if (!payload.currency?.trim()) {
      throw new ValidationError("currency is required");
    }

    const referenceNumber = generateTransactionReference("FXL");
    const lodgment = await prisma.cashLodgment.create({
      data: {
        referenceNumber,
        agentId: agent.id,
        branchId: agent.branchId,
        currency: payload.currency,
        statedAmount: amount,
        notes: payload.notes || null,
        status: "PENDING_VERIFICATION",
      },
    });

    // No admin_actions audit entry here — AdminAction.adminId is a hard FK to AdminUser,
    // and this is an agent-initiated action. The CashLodgment row itself (status, submittedAt)
    // is the record of this action; admin-side confirm/reject is what writes to admin_actions.
    logger.info("Agent submitted cash lodgment", { agentId: agent.id, lodgmentId: lodgment.id, currency: payload.currency, amount });

    eventBus.publish(EventTypes.FX_LODGMENT_SUBMITTED, { lodgmentId: lodgment.id, agentId: agent.id, currency: payload.currency, amount });

    return { ...lodgment, statedAmount: Number(lodgment.statedAmount) };
  }

  async listMyLodgments(agentUserId: string, filters: { status?: string; page?: number; limit?: number } = {}) {
    const agent = await this.resolveAgent(agentUserId);
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const where: any = { agentId: agent.id };
    if (filters.status) where.status = filters.status;

    const [rows, total] = await Promise.all([
      prisma.cashLodgment.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.cashLodgment.count({ where }),
    ]);

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        referenceNumber: r.referenceNumber,
        currency: r.currency,
        statedAmount: Number(r.statedAmount),
        confirmedAmount: r.confirmedAmount != null ? Number(r.confirmedAmount) : null,
        varianceAmount: r.varianceAmount != null ? Number(r.varianceAmount) : null,
        notes: r.notes,
        status: r.status,
        submittedAt: r.submittedAt,
        decisionReason: r.decisionReason,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async listMyDisbursements(agentUserId: string, filters: { status?: string; page?: number; limit?: number } = {}) {
    const agent = await this.resolveAgent(agentUserId);
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const where: any = { agentId: agent.id };
    if (filters.status) where.status = filters.status;

    const [rows, total] = await Promise.all([
      prisma.cashDisbursement.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * limit, take: limit }),
      prisma.cashDisbursement.count({ where }),
    ]);

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        referenceNumber: r.referenceNumber,
        currency: r.currency,
        amount: Number(r.amount),
        purpose: r.purpose,
        status: r.status,
        initiatedAt: r.initiatedAt,
        approvedAt: r.approvedAt,
        rejectedAt: r.rejectedAt,
        decisionReason: r.decisionReason,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export const agentFxInventoryService = new AgentFxInventoryService();
export default agentFxInventoryService;
