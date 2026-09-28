import { getDatabase } from "../../../config/database";
import { NotFoundError, ValidationError, createLogger, generateTransactionReference } from "../../../shared/utils";
import { eventBus, EventTypes } from "../../../events/event-bus";
import { UserRole } from "../../../shared/types";
import { fxInventoryService } from "../../admin/services/fx-inventory.service";

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

  /**
   * Agent confirms physical receipt of a disbursement already approved on the admin side.
   * This is the point at which balances actually move — the agent's cash balance increases
   * and the branch's FX inventory decreases — since the cash has now genuinely changed hands.
   */
  async confirmReceipt(agentUserId: string, disbursementId: string) {
    const agent = await this.resolveAgent(agentUserId);

    const disbursement = await prisma.cashDisbursement.findFirst({ where: { id: disbursementId, agentId: agent.id } });
    if (!disbursement) throw new NotFoundError("Cash disbursement not found");
    if (disbursement.status !== "APPROVED") {
      throw new ValidationError(`Cannot confirm receipt — disbursement is currently ${disbursement.status}`);
    }

    const updated = await prisma.cashDisbursement.update({
      where: { id: disbursementId },
      data: { status: "COMPLETED", receiptConfirmedAt: new Date() },
    });

    await prisma.cashDisbursementHistory.create({
      data: { disbursementId, action: "RECEIPT_CONFIRMED", performedBy: agent.id },
    });

    await fxInventoryService.applyDisbursementToBalances({
      id: disbursement.id, branchId: disbursement.branchId, agentId: disbursement.agentId,
      currency: disbursement.currency, amount: Number(disbursement.amount),
    });

    logger.info("Agent confirmed disbursement receipt", { agentId: agent.id, disbursementId });
    eventBus.publish(EventTypes.FX_DISBURSEMENT_RECEIPT_CONFIRMED, {
      disbursementId, agentId: agent.id, initiatedBy: disbursement.initiatedBy, approvedBy: disbursement.approvedBy,
    });

    return { ...updated, amount: Number(updated.amount) };
  }

  /**
   * Agent rejects a disbursement they were told to expect — e.g. the cash never actually
   * arrived. Per spec this does NOT terminate the disbursement: it stays awaiting the
   * agent's decision (status remains APPROVED) so the agent can still confirm later once
   * resolved. No balance change either way.
   */
  async rejectReceipt(agentUserId: string, disbursementId: string, reason: string) {
    if (!reason?.trim()) throw new ValidationError("A rejection reason is required");
    const agent = await this.resolveAgent(agentUserId);

    const disbursement = await prisma.cashDisbursement.findFirst({ where: { id: disbursementId, agentId: agent.id } });
    if (!disbursement) throw new NotFoundError("Cash disbursement not found");
    if (disbursement.status !== "APPROVED") {
      throw new ValidationError(`Cannot reject receipt — disbursement is currently ${disbursement.status}`);
    }

    const updated = await prisma.cashDisbursement.update({
      where: { id: disbursementId },
      data: { receiptRejectedAt: new Date(), receiptRejectionReason: reason },
    });

    await prisma.cashDisbursementHistory.create({
      data: { disbursementId, action: "RECEIPT_REJECTED", performedBy: agent.id, reason },
    });

    logger.info("Agent rejected disbursement receipt", { agentId: agent.id, disbursementId, reason });
    eventBus.publish(EventTypes.FX_DISBURSEMENT_RECEIPT_REJECTED, {
      disbursementId, agentId: agent.id, initiatedBy: disbursement.initiatedBy, approvedBy: disbursement.approvedBy, reason,
    });

    return { ...updated, amount: Number(updated.amount) };
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
        receiptConfirmedAt: r.receiptConfirmedAt,
        receiptRejectedAt: r.receiptRejectedAt,
        receiptRejectionReason: r.receiptRejectionReason,
        canConfirmReceipt: r.status === "APPROVED",
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }
}

export const agentFxInventoryService = new AgentFxInventoryService();
export default agentFxInventoryService;
