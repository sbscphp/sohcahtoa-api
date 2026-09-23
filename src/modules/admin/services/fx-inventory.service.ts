import { getDatabase } from "../../../config/database";
import { NotFoundError, ValidationError, createLogger, generateTransactionReference } from "../../../shared/utils";
import { ActionType } from "../../../shared/types/action-type";
import { auditTrailService } from "./audit-trail.service";
import { workflowService } from "./workflow.service";
import { eventBus, EventTypes } from "../../../events/event-bus";

const prisma: any = getDatabase();
const logger = createLogger("FxInventoryService");

class FxInventoryService {
  // ── Balances (read-only) ──────────────────────────────────────────────────

  async getInventoryBalance(branchId: string, currency: string) {
    const row = await prisma.fxInventoryBalance.findUnique({ where: { branchId_currency: { branchId, currency } } });
    return { branchId, currency, balance: row ? Number(row.balance) : 0 };
  }

  async listInventoryBalances(filters: { branchId?: string; currency?: string } = {}) {
    const where: any = {};
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.currency) where.currency = filters.currency;

    const rows = await prisma.fxInventoryBalance.findMany({
      where,
      include: { branch: { select: { name: true, branchCode: true } } },
      orderBy: [{ branchId: "asc" }, { currency: "asc" }],
    });

    return rows.map((r: any) => ({
      branchId: r.branchId,
      branchName: r.branch?.name ?? null,
      branchCode: r.branch?.branchCode ?? null,
      currency: r.currency,
      balance: Number(r.balance),
      updatedAt: r.updatedAt,
    }));
  }

  async getInventoryHistory(filters: { branchId?: string; currency?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const where: any = {};
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.currency) where.currency = filters.currency;

    const [rows, total] = await Promise.all([
      prisma.fxInventoryEntry.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.fxInventoryEntry.count({ where }),
    ]);

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        branchId: r.branchId,
        currency: r.currency,
        type: r.type,
        amount: Number(r.amount),
        balanceBefore: Number(r.balanceBefore),
        balanceAfter: Number(r.balanceAfter),
        sourceType: r.sourceType,
        sourceId: r.sourceId,
        createdAt: r.createdAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  // ── Balance mutation helper (read-then-batch-write, mirrors wallet.service.ts) ──

  private async getOrCreateInventoryBalanceRow(tx: any, branchId: string, currency: string) {
    const existing = await tx.fxInventoryBalance.findUnique({ where: { branchId_currency: { branchId, currency } } });
    if (existing) return existing;
    return tx.fxInventoryBalance.create({ data: { branchId, currency, balance: 0 } });
  }

  private async getOrCreateAgentCashBalanceRow(tx: any, agentId: string, currency: string) {
    const existing = await tx.agentCashBalance.findUnique({ where: { agentId_currency: { agentId, currency } } });
    if (existing) return existing;
    return tx.agentCashBalance.create({ data: { agentId, currency, balance: 0 } });
  }

  /**
   * Applies the balance-mutating side of a disbursement: inventory decreases, agent balance increases.
   * Must only be called once a disbursement is truly approved (final stage, or auto-approved).
   */
  private async applyDisbursementToBalances(disbursement: { id: string; branchId: string; agentId: string; currency: string; amount: number }) {
    // Balance rows may not exist yet — create them first, outside the batched array
    // (Prisma's array-form $transaction can't run dependent reads between writes).
    const [inventoryBalance, agentBalance] = await Promise.all([
      this.getOrCreateInventoryBalanceRow(prisma, disbursement.branchId, disbursement.currency),
      this.getOrCreateAgentCashBalanceRow(prisma, disbursement.agentId, disbursement.currency),
    ]);

    const invBefore = Number(inventoryBalance.balance);
    const invAfter = invBefore - disbursement.amount;
    const agentBefore = Number(agentBalance.balance);
    const agentAfter = agentBefore + disbursement.amount;

    await prisma.$transaction([
      prisma.fxInventoryBalance.update({ where: { id: inventoryBalance.id }, data: { balance: invAfter } }),
      prisma.fxInventoryEntry.create({
        data: {
          balanceId: inventoryBalance.id,
          branchId: disbursement.branchId,
          currency: disbursement.currency,
          type: "DEBIT",
          amount: disbursement.amount,
          balanceBefore: invBefore,
          balanceAfter: invAfter,
          sourceType: "CASH_DISBURSEMENT",
          sourceId: disbursement.id,
        },
      }),
      prisma.agentCashBalance.update({ where: { id: agentBalance.id }, data: { balance: agentAfter } }),
      prisma.agentCashEntry.create({
        data: {
          agentBalanceId: agentBalance.id,
          agentId: disbursement.agentId,
          currency: disbursement.currency,
          type: "CREDIT",
          amount: disbursement.amount,
          balanceBefore: agentBefore,
          balanceAfter: agentAfter,
          sourceType: "CASH_DISBURSEMENT",
          sourceId: disbursement.id,
        },
      }),
    ]);
  }

  /**
   * Applies the balance-mutating side of a lodgment confirmation: agent balance decreases, inventory increases.
   * Uses the admin-confirmed amount, not the agent-stated amount.
   */
  private async applyLodgmentToBalances(lodgment: { id: string; branchId: string; agentId: string; currency: string; confirmedAmount: number; statedAmount: number; varianceAmount: number }) {
    const [agentBalance, inventoryBalance] = await Promise.all([
      this.getOrCreateAgentCashBalanceRow(prisma, lodgment.agentId, lodgment.currency),
      this.getOrCreateInventoryBalanceRow(prisma, lodgment.branchId, lodgment.currency),
    ]);

    const agentBefore = Number(agentBalance.balance);
    const agentAfter = agentBefore - lodgment.confirmedAmount;
    const invBefore = Number(inventoryBalance.balance);
    const invAfter = invBefore + lodgment.confirmedAmount;

    const metadata = { statedAmount: lodgment.statedAmount, varianceAmount: lodgment.varianceAmount };

    await prisma.$transaction([
      prisma.agentCashBalance.update({ where: { id: agentBalance.id }, data: { balance: agentAfter } }),
      prisma.agentCashEntry.create({
        data: {
          agentBalanceId: agentBalance.id,
          agentId: lodgment.agentId,
          currency: lodgment.currency,
          type: "DEBIT",
          amount: lodgment.confirmedAmount,
          balanceBefore: agentBefore,
          balanceAfter: agentAfter,
          sourceType: "CASH_LODGMENT",
          sourceId: lodgment.id,
          metadata,
        },
      }),
      prisma.fxInventoryBalance.update({ where: { id: inventoryBalance.id }, data: { balance: invAfter } }),
      prisma.fxInventoryEntry.create({
        data: {
          balanceId: inventoryBalance.id,
          branchId: lodgment.branchId,
          currency: lodgment.currency,
          type: "CREDIT",
          amount: lodgment.confirmedAmount,
          balanceBefore: invBefore,
          balanceAfter: invAfter,
          sourceType: "CASH_LODGMENT",
          sourceId: lodgment.id,
          metadata,
        },
      }),
    ]);
  }

  // ── Cash Disbursement: Admin -> Agent ─────────────────────────────────────

  async initiateDisbursement(adminId: string, payload: { agentId: string; currency: string; amount: number; purpose?: string }) {
    const { agentId, currency, purpose } = payload;
    const amount = Number(payload.amount);

    if (!amount || isNaN(amount) || amount <= 0) {
      throw new ValidationError("amount must be a positive number");
    }

    const agent = await prisma.agent.findUnique({ where: { id: agentId } });
    if (!agent) throw new NotFoundError("Agent not found");
    if (!agent.isActive || !agent.isApproved) {
      throw new ValidationError("Agent must be active and approved to receive a cash disbursement");
    }
    if (!agent.branchId) {
      throw new ValidationError("Agent must be assigned to a branch to use FX Inventory");
    }

    const referenceNumber = generateTransactionReference("FXD");
    const template = await workflowService.findApplicableWorkflow({ approvalType: "FX_CASH_DISBURSEMENT", amount });

    if (!template || !template.stages?.length) {
      // No workflow configured — auto-approve immediately and apply balances now.
      const disbursement = await prisma.cashDisbursement.create({
        data: {
          referenceNumber,
          agentId,
          branchId: agent.branchId,
          currency,
          amount,
          purpose: purpose || null,
          status: "APPROVED",
          initiatedBy: adminId,
          autoApproved: true,
          approvedAt: new Date(),
          history: { create: { action: "AUTO_APPROVED", performedBy: adminId } },
        },
      });

      await this.applyDisbursementToBalances({ id: disbursement.id, branchId: agent.branchId, agentId, currency, amount });

      await auditTrailService.logAction({
        adminId,
        actionType: ActionType.FX_DISBURSEMENT_INITIATE,
        resourceType: "CashDisbursement",
        resourceId: disbursement.id,
        newState: { status: "APPROVED", autoApproved: true, amount, currency },
      });

      eventBus.publish(EventTypes.FX_DISBURSEMENT_APPROVED, { disbursementId: disbursement.id, agentId, initiatedBy: adminId, approvedBy: null });

      return { ...disbursement, amount: Number(disbursement.amount), autoApproved: true };
    }

    const firstStage = template.stages[0];
    const disbursement = await prisma.cashDisbursement.create({
      data: {
        referenceNumber,
        agentId,
        branchId: agent.branchId,
        currency,
        amount,
        purpose: purpose || null,
        status: "PENDING_APPROVAL",
        initiatedBy: adminId,
        workflowTemplateId: template.id,
        currentStageId: firstStage.id,
        history: { create: { action: "INITIATED", performedBy: adminId } },
      },
    });

    await auditTrailService.logAction({
      adminId,
      actionType: ActionType.FX_DISBURSEMENT_INITIATE,
      resourceType: "CashDisbursement",
      resourceId: disbursement.id,
      newState: { status: "PENDING_APPROVAL", amount, currency },
    });

    const adminIds = (firstStage.assignees || []).map((a: any) => a.adminId);
    if (adminIds.length > 0) {
      eventBus.publish(EventTypes.FX_DISBURSEMENT_REVIEW_REQUIRED, { disbursementId: disbursement.id, adminIds, agentId, initiatedBy: adminId });
    }

    return { ...disbursement, amount: Number(disbursement.amount) };
  }

  async listDisbursements(filters: { status?: string; branchId?: string; agentId?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.agentId) where.agentId = filters.agentId;

    const [rows, total] = await Promise.all([
      prisma.cashDisbursement.findMany({
        where,
        include: { agent: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cashDisbursement.count({ where }),
    ]);

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        referenceNumber: r.referenceNumber,
        agentId: r.agentId,
        agentName: r.agent?.name ?? null,
        branchId: r.branchId,
        currency: r.currency,
        amount: Number(r.amount),
        purpose: r.purpose,
        status: r.status,
        autoApproved: r.autoApproved,
        initiatedBy: r.initiatedBy,
        initiatedAt: r.initiatedAt,
        approvedBy: r.approvedBy,
        approvedAt: r.approvedAt,
        rejectedBy: r.rejectedBy,
        rejectedAt: r.rejectedAt,
        decisionReason: r.decisionReason,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async getDisbursementForApproval(id: string) {
    const disbursement = await prisma.cashDisbursement.findUnique({
      where: { id },
      include: { agent: { select: { id: true, name: true, email: true } } },
    });
    if (!disbursement) throw new NotFoundError("Cash disbursement not found");

    const initiator = await prisma.adminUser.findUnique({ where: { id: disbursement.initiatedBy }, select: { fullName: true, email: true } });
    const currentInventory = await this.getInventoryBalance(disbursement.branchId, disbursement.currency);
    const amount = Number(disbursement.amount);

    return {
      id: disbursement.id,
      referenceNumber: disbursement.referenceNumber,
      status: disbursement.status,
      agent: { id: disbursement.agent.id, name: disbursement.agent.name, email: disbursement.agent.email },
      currency: disbursement.currency,
      amount,
      purpose: disbursement.purpose,
      requestedAt: disbursement.initiatedAt,
      initiator: initiator ? { name: initiator.fullName, email: initiator.email } : null,
      currentInventoryBalance: currentInventory.balance,
      balanceAfterDisbursement: currentInventory.balance - amount,
    };
  }

  private async loadDisbursementWithWorkflow(id: string) {
    const disbursement = await prisma.cashDisbursement.findUnique({ where: { id } });
    if (!disbursement) throw new NotFoundError("Cash disbursement not found");
    if (disbursement.status !== "PENDING_APPROVAL") {
      throw new ValidationError(`Cash disbursement is already ${disbursement.status.toLowerCase()}`);
    }
    if (!disbursement.workflowTemplateId || !disbursement.currentStageId) {
      throw new ValidationError("This disbursement has no active approval workflow");
    }

    const template = await prisma.workflowTemplate.findUnique({
      where: { id: disbursement.workflowTemplateId },
      include: { stages: { orderBy: { order: "asc" }, include: { assignees: true } } },
    });
    if (!template) throw new NotFoundError("Approval workflow template not found");

    const currentStageIndex = template.stages.findIndex((s: any) => s.id === disbursement.currentStageId);
    if (currentStageIndex === -1) throw new ValidationError("Disbursement is in an invalid workflow stage");

    return { disbursement, template, currentStageIndex, currentStage: template.stages[currentStageIndex] };
  }

  async approveDisbursement(id: string, adminId: string, reason?: string) {
    const { disbursement, template, currentStageIndex, currentStage } = await this.loadDisbursementWithWorkflow(id);

    const isAssigned = currentStage.assignees.some((a: any) => String(a.adminId) === String(adminId));
    if (!isAssigned) {
      throw new ValidationError("You are not authorized to approve this disbursement at its current stage");
    }

    const isFinalStage = currentStageIndex + 1 >= template.stages.length;

    if (!isFinalStage) {
      const nextStage = template.stages[currentStageIndex + 1];
      const result = await prisma.cashDisbursement.updateMany({
        where: { id, currentStageId: disbursement.currentStageId, status: "PENDING_APPROVAL" },
        data: { currentStageId: nextStage.id },
      });
      if (result.count === 0) throw new ValidationError("Disbursement state changed concurrently — please refresh and retry");

      await prisma.cashDisbursementHistory.create({ data: { disbursementId: id, action: "STAGE_APPROVED", performedBy: adminId, reason } });

      const adminIds = (nextStage.assignees || []).map((a: any) => a.adminId);
      if (adminIds.length > 0) {
        eventBus.publish(EventTypes.FX_DISBURSEMENT_REVIEW_REQUIRED, { disbursementId: id, adminIds, agentId: disbursement.agentId, initiatedBy: disbursement.initiatedBy });
      }

      await auditTrailService.logAction({
        adminId, actionType: ActionType.FX_DISBURSEMENT_APPROVE, resourceType: "CashDisbursement", resourceId: id,
        newState: { stageAdvancedTo: nextStage.id }, reason,
      });

      return { message: `Stage "${currentStage.name}" approved. Advanced to next stage.`, isFinalApproval: false };
    }

    const result = await prisma.cashDisbursement.updateMany({
      where: { id, currentStageId: disbursement.currentStageId, status: "PENDING_APPROVAL" },
      data: { status: "APPROVED", approvedBy: adminId, approvedAt: new Date(), decisionReason: reason || null, currentStageId: null },
    });
    if (result.count === 0) throw new ValidationError("Disbursement state changed concurrently — please refresh and retry");

    await prisma.cashDisbursementHistory.create({ data: { disbursementId: id, action: "APPROVED", performedBy: adminId, reason } });

    await this.applyDisbursementToBalances({
      id: disbursement.id, branchId: disbursement.branchId, agentId: disbursement.agentId,
      currency: disbursement.currency, amount: Number(disbursement.amount),
    });

    await auditTrailService.logAction({
      adminId, actionType: ActionType.FX_DISBURSEMENT_APPROVE, resourceType: "CashDisbursement", resourceId: id,
      newState: { status: "APPROVED" }, reason,
    });

    eventBus.publish(EventTypes.FX_DISBURSEMENT_APPROVED, { disbursementId: id, agentId: disbursement.agentId, initiatedBy: disbursement.initiatedBy, approvedBy: adminId });

    return { message: "Cash disbursement approved and applied to balances.", isFinalApproval: true };
  }

  async rejectDisbursement(id: string, adminId: string, reason: string) {
    if (!reason?.trim()) throw new ValidationError("A rejection reason is required");

    const { disbursement, currentStage } = await this.loadDisbursementWithWorkflow(id);
    const isAssigned = currentStage.assignees.some((a: any) => String(a.adminId) === String(adminId));
    if (!isAssigned) {
      throw new ValidationError("You are not authorized to reject this disbursement at its current stage");
    }

    const result = await prisma.cashDisbursement.updateMany({
      where: { id, currentStageId: disbursement.currentStageId, status: "PENDING_APPROVAL" },
      data: { status: "REJECTED", rejectedBy: adminId, rejectedAt: new Date(), decisionReason: reason, currentStageId: null },
    });
    if (result.count === 0) throw new ValidationError("Disbursement state changed concurrently — please refresh and retry");

    await prisma.cashDisbursementHistory.create({ data: { disbursementId: id, action: "REJECTED", performedBy: adminId, reason } });

    await auditTrailService.logAction({
      adminId, actionType: ActionType.FX_DISBURSEMENT_REJECT, resourceType: "CashDisbursement", resourceId: id,
      newState: { status: "REJECTED" }, reason,
    });

    eventBus.publish(EventTypes.FX_DISBURSEMENT_REJECTED, { disbursementId: id, agentId: disbursement.agentId, initiatedBy: disbursement.initiatedBy, rejectedBy: adminId, reason });

    return { message: "Cash disbursement rejected.", status: "REJECTED" };
  }

  // ── Cash Lodgment: Agent -> Admin (admin-side confirm/reject) ─────────────

  async listLodgments(filters: { status?: string; branchId?: string; agentId?: string; page?: number; limit?: number } = {}) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const where: any = {};
    if (filters.status) where.status = filters.status;
    if (filters.branchId) where.branchId = filters.branchId;
    if (filters.agentId) where.agentId = filters.agentId;

    const [rows, total] = await Promise.all([
      prisma.cashLodgment.findMany({
        where,
        include: { agent: { select: { name: true, email: true } } },
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.cashLodgment.count({ where }),
    ]);

    return {
      data: rows.map((r: any) => ({
        id: r.id,
        referenceNumber: r.referenceNumber,
        agentId: r.agentId,
        agentName: r.agent?.name ?? null,
        branchId: r.branchId,
        currency: r.currency,
        statedAmount: Number(r.statedAmount),
        confirmedAmount: r.confirmedAmount != null ? Number(r.confirmedAmount) : null,
        varianceAmount: r.varianceAmount != null ? Number(r.varianceAmount) : null,
        notes: r.notes,
        status: r.status,
        submittedAt: r.submittedAt,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  async confirmLodgment(id: string, adminId: string, confirmedAmount?: number, reason?: string) {
    const lodgment = await prisma.cashLodgment.findUnique({ where: { id } });
    if (!lodgment) throw new NotFoundError("Cash lodgment not found");
    if (lodgment.status !== "PENDING_VERIFICATION") {
      throw new ValidationError(`Cash lodgment is already ${lodgment.status.toLowerCase()}`);
    }

    const statedAmount = Number(lodgment.statedAmount);
    const finalAmount = confirmedAmount != null ? Number(confirmedAmount) : statedAmount;
    if (!finalAmount || isNaN(finalAmount) || finalAmount <= 0) {
      throw new ValidationError("confirmedAmount must be a positive number");
    }
    const varianceAmount = Math.round((finalAmount - statedAmount) * 100) / 100;

    const updated = await prisma.cashLodgment.update({
      where: { id },
      data: {
        status: "CONFIRMED",
        confirmedAmount: finalAmount,
        varianceAmount,
        confirmedBy: adminId,
        confirmedAt: new Date(),
        decisionReason: reason || null,
      },
    });

    await this.applyLodgmentToBalances({
      id: lodgment.id, branchId: lodgment.branchId, agentId: lodgment.agentId, currency: lodgment.currency,
      confirmedAmount: finalAmount, statedAmount, varianceAmount,
    });

    await auditTrailService.logAction({
      adminId, actionType: ActionType.FX_LODGMENT_CONFIRM, resourceType: "CashLodgment", resourceId: id,
      previousState: { statedAmount }, newState: { confirmedAmount: finalAmount, varianceAmount }, reason,
    });

    eventBus.publish(EventTypes.FX_LODGMENT_CONFIRMED, { lodgmentId: id, agentId: lodgment.agentId, confirmedBy: adminId, varianceAmount });

    return { ...updated, statedAmount, confirmedAmount: finalAmount, varianceAmount };
  }

  async rejectLodgment(id: string, adminId: string, reason: string) {
    if (!reason?.trim()) throw new ValidationError("A rejection reason is required");

    const lodgment = await prisma.cashLodgment.findUnique({ where: { id } });
    if (!lodgment) throw new NotFoundError("Cash lodgment not found");
    if (lodgment.status !== "PENDING_VERIFICATION") {
      throw new ValidationError(`Cash lodgment is already ${lodgment.status.toLowerCase()}`);
    }

    await prisma.cashLodgment.update({
      where: { id },
      data: { status: "REJECTED", rejectedBy: adminId, rejectedAt: new Date(), decisionReason: reason },
    });

    await auditTrailService.logAction({
      adminId, actionType: ActionType.FX_LODGMENT_REJECT, resourceType: "CashLodgment", resourceId: id,
      newState: { status: "REJECTED" }, reason,
    });

    eventBus.publish(EventTypes.FX_LODGMENT_REJECTED, { lodgmentId: id, agentId: lodgment.agentId, rejectedBy: adminId, reason });

    return { message: "Cash lodgment rejected.", status: "REJECTED" };
  }
}

export const fxInventoryService = new FxInventoryService();
export default fxInventoryService;
