import { getDatabase } from "../../../config/database";
const prisma = getDatabase();
import { createLogger } from "../../../shared/utils";
import { ServiceName, TransactionStep, TransactionStatus, VerificationStatus, TransactionMode, DisbursementMethod } from "../../../shared/types";
import { auditTrailService } from "../services/audit-trail.service";
import { workflowService } from "../services/workflow.service";
import { eventBus, EventTypes } from "../../../events/event-bus";

const logger = createLogger(ServiceName.ADMIN);

type ReviewPayload = {
  notes?: string;
  riskLevel?: "LOW" | "MEDIUM" | "HIGH";
  amlDecision?: "PASS" | "FAIL" | "ESCALATE";
};

const BUY_GROUP_TYPES = ["PTA", "BTA", "SCHOOL_FEES", "MEDICAL", "PROFESSIONAL_BODY"];
const SELL_GROUP_TYPES = ["RESIDENT_FX", "EXPATRIATE_FX"];

function appendOrFilter(where: any, orClauses: any[]) {
  if (Array.isArray(where.AND)) {
    where.AND.push({ OR: orClauses });
    return;
  }

  if (where.OR) {
    const existingOr = where.OR;
    delete where.OR;
    where.AND = [{ OR: existingOr }, { OR: orClauses }];
    return;
  }

  where.OR = orClauses;
}

function applyBuySellFxFilter(where: any, rawType: string) {
  if (rawType === "buyfx" || rawType === "sellfx") {
    const mode = rawType === "buyfx" ? TransactionMode.BUY : TransactionMode.SELL;
    const group = rawType === "buyfx" ? BUY_GROUP_TYPES : SELL_GROUP_TYPES;
    appendOrFilter(where, [
      { AND: [{ type: "TOURIST_FX" }, { transactionMode: mode as any }] },
      { type: { in: group as any } },
    ]);
    return true;
  }
  if (rawType === "receivefx") {
    where.disbursementMethod = DisbursementMethod.IMTO;
    return true;
  }
  return false;
}

type SettlePayload = {
  disbursementMethod: string;
  settlementReference: string;
};

export class AdminTransactionsService {

  // private async logAdminAction(params: {
  //   adminId: string;
  //   actionType: any;
  //   resourceType: string;
  //   resourceId: string;
  //   reason?: string;
  //   metadata?: any;
  // }) {
  //   return prisma.adminAction.create({
  //     data: {
  //       adminId: params.adminId,
  //       actionType: String(params.actionType) as any,
  //       resourceType: params.resourceType,
  //       resourceId: params.resourceId,
  //       reason: params.reason,
  //       metadata: params.metadata,
  //     },
  //   });
  // }

  async getTransactionStats() {
    const [underReviewA, underReviewB, underReviewC, underReviewD, rejected, approved, reqInfoGroup] = await Promise.all([
      prisma.transaction.count({ where: { status: TransactionStatus.AWAITING_VERIFICATION } as any }),
      prisma.transaction.count({ where: { status: TransactionStatus.VERIFICATION_IN_PROGRESS } as any }),
      prisma.transaction.count({ where: { status: TransactionStatus.COMPLIANCE_REVIEW } as any }),
      prisma.transaction.count({ where: { status: TransactionStatus.ADMIN_APPROVAL_PENDING } as any }),
      prisma.transaction.count({ where: { status: TransactionStatus.REJECTED } as any }),
      prisma.transaction.count({ where: { status: TransactionStatus.APPROVED } as any }),
      prisma.transactionDocument.groupBy({
        by: ["transactionId"],
        where: { verificationStatus: VerificationStatus.REQUIRES_MANUAL_REVIEW } as any,
      }),
    ]);
    const requestInformation = Array.isArray(reqInfoGroup) ? reqInfoGroup.length : 0;
    return {
      underReview: underReviewA + underReviewB + underReviewC + underReviewD,
      rejected,
      requestInformation,
      approved,
    };
  }

  private async buildTransactionsListQuery(filters: any) {
    const where: any = {};
    if (filters.status) where.status = (filters.status as string).toUpperCase();
    if (filters.step) where.currentStep = (filters.step as string).toUpperCase();

    const rawType = (filters.type || "").toString().trim().toLowerCase();
    if (!applyBuySellFxFilter(where, rawType) && rawType) {
      where.type = (filters.type as string).toUpperCase();
    }

    if (filters.userId) where.userId = filters.userId;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const search = (filters.search || "").toString().trim();
    if (search) {
      const matchedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search, mode: "insensitive" } },
            { profile: { firstName: { contains: search, mode: "insensitive" } } },
            { profile: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        },
        select: { id: true },
      });
      const userIds = matchedUsers.map((u) => u.id);
      where.OR = [
        { referenceNumber: { contains: search, mode: "insensitive" } },
        ...(userIds.length ? [{ userId: { in: userIds } }] : []),
      ];
    }

    const orderBy: any = {};
    const sortBy = filters.sortBy || "createdAt";
    const sortOrder = (filters.sortOrder || "desc").toLowerCase() === "asc" ? "asc" : "desc";
    orderBy[sortBy] = sortOrder;

    return { where, orderBy };
  }

  private async fetchTransactionsList(where: any, orderBy: any, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    const uniqueUserIds = Array.from(new Set(items.map((t) => t.userId)));
    const users = uniqueUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: {
            id: true,
            profile: { select: { firstName: true, lastName: true } },
          },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = items.map((t: any) => {
      const u: any = userMap.get(t.userId);
      const name = u && u.profile ? `${u.profile.firstName || ""} ${u.profile.lastName || ""}`.trim() : undefined;
      const value = Number(t.nairaEquivalent || t.foreignAmount || 0);
      return {
        id: t.id,
        customerName: name,
        dateAndId: { date: t.createdAt, reference: t.referenceNumber },
        transactionType: t.type,
        transactionMode: t.transactionMode,
        transactionStage: t.currentStep,
        workflowStage: t.status,
        transactionValue: value,
        currency: t.currency,
        status: t.status,
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listTransactions(filters: any, page = 1, limit = 20) {
    const { where, orderBy } = await this.buildTransactionsListQuery(filters);
    return this.fetchTransactionsList(where, orderBy, page, limit);
  }

  async listBuyTransactions(filters: any, page = 1, limit = 20) {
    const { where, orderBy } = await this.buildTransactionsListQuery(filters);
    delete where.type;
    delete where.transactionMode;
    applyBuySellFxFilter(where, "buyfx");
    return this.fetchTransactionsList(where, orderBy, page, limit);
  }

  async listSellTransactions(filters: any, page = 1, limit = 20) {
    const { where, orderBy } = await this.buildTransactionsListQuery(filters);
    delete where.type;
    delete where.transactionMode;
    applyBuySellFxFilter(where, "sellfx");
    where.status = { in: [TransactionStatus.DISBURSEMENT_IN_PROGRESS, TransactionStatus.COMPLETED] };
    return this.fetchTransactionsList(where, orderBy, page, limit);
  }

  async listReceiveTransactions(filters: any, page = 1, limit = 20) {
    const { where, orderBy } = await this.buildTransactionsListQuery(filters);
    where.disbursementMethod = "IMTO";
    return this.fetchTransactionsList(where, orderBy, page, limit);
  }

  async getTransaction(id: string, adminId?: string) {
    let trx = await prisma.transaction.findUnique(
      {
        where: { id },
        include: {
          steps: { orderBy: { createdAt: "asc" } },
          documents: true,
          history: { orderBy: { createdAt: "asc" } },
          receipt: true,
          cashPickup: true,
          createdByAgent: { select: { branchId: true } },
        },
      } as any
    );
    if (!trx) return null;

    const user = await prisma.user.findUnique({
      where: { id: (trx as any).userId },
      include: { profile: true, kyc: true },
    });
    const name =
      user?.profile
        ? `${user.profile.firstName || ""} ${user.profile.lastName || ""}`.trim()
        : undefined;
    const bvn = user?.kyc?.bvn || null;
    const maskedBvn = bvn ? `${bvn.slice(0, 2)}********* ${bvn.slice(-3)}` : null;
    const docCount = Array.isArray((trx as any).documents) ? (trx as any).documents.length : 0;
    const pickup = (trx as any).cashPickup || null;
    const valueFx = Number(trx.foreignAmount || 0);
    const valueNgn = Number(trx.nairaEquivalent || 0);
    const statusLabel = trx.status;
    const stageLabel = trx.currentStep;
    const requestStatus =
      trx.status === TransactionStatus.VERIFICATION_IN_PROGRESS || trx.status === TransactionStatus.ADMIN_APPROVAL_PENDING
        ? "Under Review"
        : trx.status === TransactionStatus.REJECTED
        ? "Rejected"
        : trx.status === TransactionStatus.APPROVED
        ? "Approved"
        : trx.status === (TransactionStatus.PENDING_RECORD_VALIDATION as any)
        ? "Pending Record Validation"
        : trx.status === (TransactionStatus.DISBURSEMENT_IN_PROGRESS as any)
        ? "Disbursement In Progress"
        : "Pending";      

    const history = Array.isArray((trx as any).history) ? (trx as any).history : [];
    const steps = Array.isArray((trx as any).steps) ? (trx as any).steps : [];
    const actorIds = new Set<string>();
    for (const h of history) {
      if (h?.performedBy) actorIds.add(String(h.performedBy));
    }
    for (const s of steps) {
      const d = s?.data as any;
      const candidates = [d?.reviewedBy, d?.confirmedBy, d?.settledBy, d?.approvedBy, d?.rejectedBy].filter(Boolean);
      for (const c of candidates) actorIds.add(String(c));
    }
    const adminUsers = actorIds.size
      ? await prisma.adminUser.findMany({
          where: { id: { in: Array.from(actorIds) } },
          select: {
            id: true,
            fullName: true,
            position: true,
            role: { select: { name: true } },
          },
        })
      : [];
    const adminMap: Record<string, { fullName: string; position: string | null; roleName: string | null }> = {};
    for (const a of adminUsers) {
      adminMap[a.id] = {
        fullName: a.fullName,
        position: a.position || null,
        roleName: (a as any).role?.name || null,
      };
    }
    const toTitle = (action: string) => {
      if (action === "ADMIN_REVIEW_COMPLETED") return "Review Completed";
      if (action === "TRANSACTION_APPROVED") return "Approved";
      if (action === "TRANSACTION_REJECTED") return "Rejected";
      if (action === "TRANSACTION_SETTLED") return "Settled";
      if (action === "DEPOSIT_CONFIRMED") return "Deposit Confirmed";
      if (action === "DOCUMENT_MORE_INFO_REQUESTED") return "More Info Requested";
      if (action === "DOCUMENT_APPROVED") return "Document Approved";
      if (action === "DOCUMENT_REJECTED") return "Document Rejected";
      return action;
    };
    const toOutcome = (action: string) => {
      if (action === "DOCUMENT_APPROVED") return "Completed";
      if (action === "DOCUMENT_REJECTED") return "Rejected";
      if (action.includes("REJECT")) return "Rejected";
      if (action.includes("APPROV")) return "Approved";
      if (action.includes("COMPLETED")) return "Review Completed";
      if (action.includes("CONFIRMED")) return "Confirmed";
      return "Action Taken";
    };
    const workflowLine = history
      .filter((h: any) => Boolean(h?.performedBy))
      .map((h: any) => {
        const adminId = String(h.performedBy);
        const admin = adminMap[adminId];
        return {
          id: h.id,
          timestamp: h.createdAt,
          adminId,
          adminName: admin?.fullName || adminId,
          adminRole: admin?.position || admin?.roleName || null,
          title: toTitle(String(h.action || "")),
          outcome: toOutcome(String(h.action || "")),
          comment: h.notes || null,
          action: h.action,
        };
      });
    const decoratedHistory = history.map((h: any) => {
      const adminId = h?.performedBy ? String(h.performedBy) : "";
      const admin = adminId ? adminMap[adminId] : undefined;
      return { ...h, performedBy: admin?.fullName || adminId || null };
    });
    let isApprovalOfficer = false;
    let approvalState: string | null = null;
    let pendingAssignees: any[] = [];

    // Find workflow template
    let workflow = null;
    if (trx.workflowTemplateId) {
      workflow = await prisma.workflowTemplate.findUnique({
        where: { id: trx.workflowTemplateId },
        include: {
          stages: {
            orderBy: { order: "asc" },
            include: {
              assignees: {
                include: {
                  admin: {
                    select: { id: true, fullName: true, role: { select: { name: true } } }
                  }
                }
              }
            }
          }
        }
      });
    }

    // If template ID is set but workflow not found, or no template ID set, try to re-attach
    if (!workflow && trx.status !== "APPROVED" && trx.status !== "REJECTED") {
      const updated = await workflowService.attachWorkflowToTransaction(id).catch(() => null);
      if (updated && updated.workflowTemplateId) {
        workflow = await prisma.workflowTemplate.findUnique({
          where: { id: updated.workflowTemplateId },
          include: {
            stages: {
              orderBy: { order: "asc" },
              include: {
                assignees: {
                  include: {
                    admin: {
                      select: { id: true, fullName: true, role: { select: { name: true } } }
                    }
                  }
                }
              }
            }
          }
        });
      }

      // Final fallback: just find applicable workflow without attaching if it's still null
      if (!workflow) {
        workflow = await workflowService.findApplicableWorkflow({
          branchId: (trx as any).createdByAgent?.branchId || undefined,
          action: "Transaction Approval",
        });
      }
    }

    let activeStage: any = null;
    if (workflow) {
      if (adminId) {
        // Check if user is assigned to ANY stage in the entire workflow
        isApprovalOfficer = workflow.stages.some((s: any) => 
          s.assignees.some((a: any) => String(a.adminId).toLowerCase() === String(adminId).toLowerCase())
        );
      }

      if (trx.currentWorkflowStageId) {
        activeStage = workflow.stages.find((s: any) => s.id === trx.currentWorkflowStageId);
      } 
      
      // Fallback to first stage if not officially started but still pending
      if (!activeStage && workflow.stages.length > 0 && trx.status !== "APPROVED" && trx.status !== "REJECTED") {
        activeStage = workflow.stages[0];
      }

      if (activeStage) {
        const currentStageIndex = workflow.stages.findIndex((s: any) => s.id === activeStage.id);
        if (currentStageIndex !== -1) {
          const totalStages = workflow.stages.length;
          approvalState = `Stage ${currentStageIndex + 1} of ${totalStages} (${activeStage.name})`;

          pendingAssignees = activeStage.assignees.map((a: any) => ({
            adminId: a.adminId,
            adminName: a.admin?.fullName || "Unknown Admin",
            roleName: a.admin?.role?.name || "No Role",
          }));
        }
      } else if (trx.status === "APPROVED") {
        approvalState = "Approved (Workflow Completed)";
      }
    }

    const workflowStages = workflow?.stages.map((s: any) => ({
      stageId: s.id,
      name: s.name,
      order: s.order,
      isCurrent: activeStage ? s.id === activeStage.id : false,
      assignees: s.assignees.map((a: any) => ({
        adminId: a.adminId,
        adminName: a.admin?.fullName || "Unknown Admin",
        roleName: a.admin?.role?.name || "No Role",
      })),
    })) || [];

    return {
      id: trx.id,
      reference: trx.referenceNumber,
      date: trx.createdAt,
      time: trx.createdAt,
      customerName: name,
      customerType: user?.customerType || null,
      transactionType: trx.type,
      fxType: "Buy FX",
      transactionStage: stageLabel,
      workflowStage: statusLabel,
      requestStatus,
      approvalProcess: {
        isApprovalOfficer,
        approvalState,
        pendingAssignees,
        workflowStages,
      },
      details: {
        transactionValueFx: valueFx,
        transactionValueNgn: valueNgn,
        transactionCurrency: trx.currency,
        requesterType: "Customer Direct",
        bvnNumber: maskedBvn,
        numberOfDocuments: docCount,
        pickupLocation: pickup?.pickupLocation || null,
        scheduledPickupDate: pickup?.scheduledPickupDate || null,
        scheduledPickupTime: pickup?.scheduledPickupTime || null,
      },
      workflowLine,
      raw: { ...(trx as any), history: decoratedHistory },
    };
  }

  async requestInformation(transactionId: string, adminId: string, payload: { notes?: string; fields?: string[] }) {

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { workflowTemplateId: true, currentWorkflowStageId: true }
    });

    if (tx?.workflowTemplateId && tx?.currentWorkflowStageId) {
      const workflow = await prisma.workflowTemplate.findUnique({
        where: { id: tx.workflowTemplateId },
        include: { stages: { include: { assignees: true } } }
      });
      if (workflow) {
        const currentStage = workflow.stages.find((s: any) => s.id === tx.currentWorkflowStageId);
        if (currentStage) {
          const isAssigned = currentStage.assignees.some((a: any) => String(a.adminId) === String(adminId));
          if (!isAssigned) {
             throw new Error("You are not authorized to request information for this transaction at its current stage.");
          }
        }
      }
    }

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { status: TransactionStatus.COMPLIANCE_REVIEW as any },
    });

    await prisma.transactionDocument.updateMany({
      where: { transactionId },
      data: { verificationStatus: VerificationStatus.PENDING as any },
    });

    return { message: "Request for information recorded" };
  }

  async reviewTransaction(transactionId: string, adminId: string, payload: ReviewPayload) {

    const existingTx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { status: true, currentWorkflowStageId: true, workflowTemplateId: true, userId: true, referenceNumber: true }
    });

    if (!existingTx) throw new Error("Transaction not found");

    if (existingTx.status === TransactionStatus.ADMIN_APPROVAL_PENDING) {
      throw new Error("Transaction is already under review.");
    }
    if (existingTx.status === TransactionStatus.APPROVED || existingTx.status === TransactionStatus.REJECTED) {
      throw new Error("Transaction is already completed.");
    }

    if (existingTx.workflowTemplateId && existingTx.currentWorkflowStageId) {
      const workflow = await prisma.workflowTemplate.findUnique({
        where: { id: existingTx.workflowTemplateId },
        include: { stages: { include: { assignees: true } } }
      });
      if (workflow) {
        const currentStage = workflow.stages.find((s: any) => s.id === existingTx.currentWorkflowStageId);
        if (currentStage) {
          const isAssigned = currentStage.assignees.some((a: any) => String(a.adminId) === String(adminId));
          if (!isAssigned) {
            throw new Error("You are not authorized to review this transaction at its current stage.");
          }
        }
      }
    }

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        currentStep: TransactionStep.ADMIN_REVIEW as any,
        status: TransactionStatus.ADMIN_APPROVAL_PENDING as any,
        updatedAt: new Date(),
      },
    });

    await prisma.transactionStepLog.create({
      data: {
        transactionId,
        step: TransactionStep.ADMIN_REVIEW as any,
        status: "COMPLETED",
        data: { reviewedBy: adminId, ...payload },
        completedAt: new Date(),
      },
    });

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        action: "ADMIN_REVIEW_COMPLETED",
        performedBy: adminId,
        notes: payload?.notes,
        metadata: { riskLevel: payload?.riskLevel, amlDecision: payload?.amlDecision },
      } as any,
    });

    const trx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { 
        type: true, 
        workflowTemplateId: true, 
        currentWorkflowStageId: true,
        createdByAgent: {
          select: { branchId: true }
        }
      },
    });

    let workflow = null;
    if (trx?.workflowTemplateId) {
      workflow = await prisma.workflowTemplate.findUnique({
        where: { id: trx.workflowTemplateId },
        include: { stages: { orderBy: { order: "asc" }, include: { assignees: true } } },
      });
    } else {
      // Find applicable workflow
      workflow = await workflowService.findApplicableWorkflow({
        branchId: trx?.createdByAgent?.branchId || undefined,
        action: "Transaction Approval",
      });
    }

    let adminIds: string[] = [];
    let nextStageId: string | null = null;

    if (workflow) {
      const stages = workflow.stages;
      const currentIndex = trx?.currentWorkflowStageId 
        ? stages.findIndex((s: any) => s.id === trx.currentWorkflowStageId)
        : -1;
      
      const nextStage = stages[currentIndex + 1];
      if (nextStage) {
        adminIds = nextStage.assignees.map((a: any) => a.adminId);
        nextStageId = nextStage.id;

        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            workflowTemplateId: workflow.id,
            currentWorkflowStageId: nextStageId,
          },
        });
      } else {
        // Review was the final stage in the workflow
        await prisma.transaction.update({
          where: { id: transactionId },
          data: {
            status: TransactionStatus.APPROVED as any,
            currentWorkflowStageId: null,
          },
        });

        eventBus.publish(EventTypes.TRANSACTION_APPROVED, {
          userId: existingTx.userId,
          transaction: { id: transactionId, referenceNumber: existingTx.referenceNumber },
        });
      }
    }

    if (adminIds.length === 0 && !workflow) {
      // Fallback to legacy logic if no workflow found
      const fallbackAdmins = await prisma.adminUser.findMany({
        where: { isActive: true },
        select: { id: true, position: true, role: { select: { name: true } } },
      });
      const wanted = ["Internal Control", "Finance Manager", "Settlement"];
      adminIds = fallbackAdmins
        .filter((u: any) => {
          const pos = (u.position || "").toString();
          const role = ((u as any).role?.name || "").toString();
          return wanted.some((w) => pos.includes(w) || role.includes(w));
        })
        .map((u: any) => u.id);
    }

    if (adminIds.length > 0) {
      const txBrief: any = await prisma.transaction.findUnique({
        where: { id: transactionId },
        select: {
          id: true,
          referenceNumber: true,
          type: true,
          foreignAmount: true,
          nairaEquivalent: true,
          userId: true,
        },
      });

      if (txBrief) {
        const user = await prisma.user.findUnique({
          where: { id: txBrief.userId },
          select: {
            profile: {
              select: { firstName: true, lastName: true },
            },
            email: true,
          },
        });

        const customerName = user?.profile
          ? `${user.profile.firstName} ${user.profile.lastName}`.trim()
          : user?.email;

        eventBus.publish(EventTypes.ADMIN_REVIEW_REQUIRED, {
          adminIds,
          transaction: {
            ...txBrief,
            customerName,
          },
        });
      }
    }

    return { message: "Transaction reviewed successfully" };
  }

  async approveTransaction(transactionId: string, adminId: string, reason?: string) {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        referenceNumber: true,
        userId: true,
        workflowTemplateId: true,
        currentWorkflowStageId: true,
        status: true,
        type: true,
        foreignAmount: true,
        nairaEquivalent: true,
      }
    });

    if (!tx) throw new Error("Transaction not found");
    if (tx.status === TransactionStatus.APPROVED) throw new Error("Transaction is already approved");

    let isFinalApproval = true;
    let nextStageId: string | null = null;
    let nextStageAssignees: string[] = [];

    if (tx.workflowTemplateId && !tx.currentWorkflowStageId) {
      throw new Error("Transaction workflow state is invalid (missing current stage).");
    }

    if (tx.workflowTemplateId && tx.currentWorkflowStageId) {
      const workflow = await prisma.workflowTemplate.findUnique({
        where: { id: tx.workflowTemplateId },
        include: {
          stages: {
            orderBy: { order: "asc" },
            include: { assignees: true }
          }
        }
      });

      if (workflow) {
        let currentStageIndex = workflow.stages.findIndex((s: any) => s.id === tx.currentWorkflowStageId);
        
        if (currentStageIndex === -1) {
          if (workflow.stages.length > 0) {
            const firstStage = workflow.stages[0];
            await prisma.transaction.update({
              where: { id: transactionId },
              data: { currentWorkflowStageId: firstStage.id }
            });
            currentStageIndex = 0;
          } else {
            throw new Error("Transaction is in an invalid workflow stage (the workflow template has no stages configured).");
          }
        }
        
        const currentStage = workflow.stages[currentStageIndex];
        const isAssigned = currentStage.assignees.some((a: any) => String(a.adminId) === String(adminId));
        
        if (!isAssigned) {
           throw new Error("You are not authorized to approve this transaction at its current stage.");
        }

        if (currentStageIndex + 1 < workflow.stages.length) {
          const nextStage = workflow.stages[currentStageIndex + 1];
          isFinalApproval = false;
          nextStageId = nextStage.id;
          nextStageAssignees = nextStage.assignees.map((a: any) => a.adminId);
        }
      }
    }

    if (isFinalApproval) {
      const updateResult = await prisma.transaction.updateMany({
        where: { 
          id: transactionId,
          currentWorkflowStageId: tx.currentWorkflowStageId
        },
        data: {
          status: TransactionStatus.APPROVED as any,
          currentStep: TransactionStep.ADMIN_REVIEW as any,
          currentWorkflowStageId: null,
          updatedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new Error("Transaction state changed during approval. Please refresh and try again.");
      }

      const transaction = await prisma.transaction.findUnique({ where: { id: transactionId } });
      if (!transaction) throw new Error("Transaction not found after update");

      await prisma.transactionDocument.updateMany({
        where: { transactionId, verificationStatus: VerificationStatus.PENDING as any },
        data: { verificationStatus: VerificationStatus.VERIFIED as any, verifiedAt: new Date(), verifiedBy: adminId } as any,
      });

      await prisma.transactionHistory.create({
        data: { transactionId, action: "TRANSACTION_APPROVED", performedBy: adminId, notes: reason },
      });

      eventBus.publish(EventTypes.TRANSACTION_APPROVED, {
        userId: transaction.userId,
        transaction: { id: transaction.id, referenceNumber: transaction.referenceNumber },
      });

      return { message: "Transaction approved successfully" };
    } else {
      const updateResult = await prisma.transaction.updateMany({
        where: { 
          id: transactionId,
          currentWorkflowStageId: tx.currentWorkflowStageId
        },
        data: {
          currentWorkflowStageId: nextStageId,
          updatedAt: new Date(),
        },
      });

      if (updateResult.count === 0) {
        throw new Error("Transaction state changed during approval. Please refresh and try again.");
      }

      await prisma.transactionHistory.create({
        data: { transactionId, action: "TRANSACTION_STAGE_APPROVED", performedBy: adminId, notes: reason },
      });

      if (nextStageAssignees.length > 0) {
        const user = await prisma.user.findUnique({
          where: { id: tx.userId },
          select: { profile: { select: { firstName: true, lastName: true } }, email: true },
        });
        const customerName = user?.profile ? `${user.profile.firstName} ${user.profile.lastName}`.trim() : user?.email;

        eventBus.publish(EventTypes.ADMIN_REVIEW_REQUIRED, {
          adminIds: nextStageAssignees,
          transaction: { ...tx, customerName },
        });
      }

      return { message: "Transaction advanced to the next approval stage" };
    }
  }

  async rejectTransaction(transactionId: string, adminId: string, reason: string) {

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        workflowTemplateId: true,
        currentWorkflowStageId: true,
        status: true,
        userId: true,
        referenceNumber: true,
      }
    });

    if (!tx) throw new Error("Transaction not found");
    if (tx.status === "REJECTED") throw new Error("Transaction is already rejected");

    if (tx.workflowTemplateId && tx.currentWorkflowStageId) {
      const workflow = await prisma.workflowTemplate.findUnique({
        where: { id: tx.workflowTemplateId },
        include: { stages: { include: { assignees: true } } }
      });

      if (workflow) {
        const currentStage = workflow.stages.find((s: any) => s.id === tx.currentWorkflowStageId);
        if (currentStage) {
          const isAssigned = currentStage.assignees.some((a: any) => String(a.adminId) === String(adminId));
          if (!isAssigned) {
             throw new Error("You are not authorized to reject this transaction at its current stage.");
          }
        }
      }
    }

    const transaction = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        status: TransactionStatus.REJECTED as any,
        currentStep: TransactionStep.ADMIN_REVIEW as any,
        rejectionReason: reason,
        rejectedAt: new Date(),
        updatedAt: new Date(),
      },
    } as any);

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        action: "TRANSACTION_REJECTED",
        performedBy: adminId,
        notes: reason,
      },
    });

    // Publish event for notifications
    eventBus.publish(EventTypes.TRANSACTION_REJECTED, {
      userId: transaction.userId,
      transaction: {
        id: transaction.id,
        referenceNumber: transaction.referenceNumber,
      },
      reason,
    });

    return { message: "Transaction rejected successfully" };
  }

  async approveTransactionDocument(transactionId: string, documentId: string, adminId: string, notes?: string) {
    const document = await prisma.transactionDocument.findFirst({
      where: { id: documentId, transactionId },
      select: { id: true, transactionId: true, documentType: true },
    });
    if (!document) throw new Error("Document not found");

    const updated = await prisma.transactionDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: VerificationStatus.VERIFIED as any,
        verificationNotes: notes || null,
        verifiedAt: new Date(),
        verifiedBy: adminId,
      } as any,
      select: {
        id: true,
        transactionId: true,
        documentType: true,
        fileUrl: true,
        fileName: true,
        fileSize: true,
        verificationStatus: true,
        verificationNotes: true,
        verifiedAt: true,
        verifiedBy: true,
        uploadedAt: true,
      },
    });

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        action: "DOCUMENT_APPROVED",
        performedBy: adminId,
        notes: notes || "Document approved",
        metadata: { documentId, documentType: updated.documentType },
      } as any,
    });

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { userId: true, id: true, referenceNumber: true, currentStep: true },
    });
    if (tx) {
      eventBus.publish(EventTypes.DOCUMENT_VERIFIED, {
        userId: tx.userId,
        documentId: updated.id,
        transactionId,
        documentType: updated.documentType,
        verifiedBy: adminId,
        transaction: { id: tx.id, referenceNumber: tx.referenceNumber },
      });
    }

    // Check if all documents for the transaction are now verified
    const allDocs = await prisma.transactionDocument.findMany({
      where: { transactionId },
    });
    const allVerified = allDocs.length > 0 && allDocs.every(
      (doc) => doc.verificationStatus === "VERIFIED"
    );

    if (allVerified) {
      await prisma.transaction.update({
        where: { id: transactionId },
        data: { status: "VERIFICATION_COMPLETED" },
      });

      await prisma.transactionHistory.create({
        data: {
          transactionId,
          action: "VERIFICATION_COMPLETED",
          performedBy: adminId,
          notes: "All documents approved, verification completed",
        } as any,
      });

      if (tx) {
        eventBus.publish(EventTypes.TRANSACTION_UPDATED, {
          userId: tx.userId,
          transactionId,
          step: (tx as any).currentStep || "DOCUMENT_UPLOAD",
          status: "VERIFICATION_COMPLETED",
          transaction: { id: tx.id, referenceNumber: tx.referenceNumber },
        });
      }
    }

    return updated;
  }

  async rejectTransactionDocument(transactionId: string, documentId: string, adminId: string, reason: string) {
    const document = await prisma.transactionDocument.findFirst({
      where: { id: documentId, transactionId },
      select: { id: true, transactionId: true, documentType: true },
    });
    if (!document) throw new Error("Document not found");

    const updated = await prisma.transactionDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: VerificationStatus.FAILED as any,
        verificationNotes: reason || null,
        verifiedAt: new Date(),
        verifiedBy: adminId,
      } as any,
      select: {
        id: true,
        transactionId: true,
        documentType: true,
        fileUrl: true,
        fileName: true,
        fileSize: true,
        verificationStatus: true,
        verificationNotes: true,
        verifiedAt: true,
        verifiedBy: true,
        uploadedAt: true,
      },
    });

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        action: "DOCUMENT_REJECTED",
        performedBy: adminId,
        notes: reason,
        metadata: { documentId, documentType: updated.documentType },
      } as any,
    });

    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: { userId: true, id: true, referenceNumber: true },
    });
    if (tx) {
      eventBus.publish(EventTypes.DOCUMENT_REJECTED, {
        userId: tx.userId,
        documentId: updated.id,
        transactionId,
        documentType: updated.documentType,
        rejectedBy: adminId,
        reason,
        transaction: { id: tx.id, referenceNumber: tx.referenceNumber },
      });
    }

    return updated;
  }

  async requestMoreInfoOnTransactionDocument(transactionId: string, documentId: string, adminId: string, comment: string) {
    const document = await prisma.transactionDocument.findFirst({
      where: { id: documentId, transactionId },
      select: { id: true, transactionId: true, documentType: true },
    });
    if (!document) throw new Error("Document not found");

    const updated = await prisma.transactionDocument.update({
      where: { id: documentId },
      data: {
        verificationStatus: VerificationStatus.PENDING as any,
        verificationNotes: comment,
        verifiedAt: null,
        verifiedBy: null,
      } as any,
      select: {
        id: true,
        transactionId: true,
        documentType: true,
        fileUrl: true,
        fileName: true,
        fileSize: true,
        verificationStatus: true,
        verificationNotes: true,
        verifiedAt: true,
        verifiedBy: true,
        uploadedAt: true,
      },
    });

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        action: "DOCUMENT_MORE_INFO_REQUESTED",
        performedBy: adminId,
        notes: comment,
        metadata: { documentId, documentType: updated.documentType },
      } as any,
    });

    return updated;
  }

  async settleTransaction(transactionId: string, adminId: string, payload: SettlePayload) {

    const updated = await prisma.transaction.update({
      where: { id: transactionId },
      data: {
        currentStep: TransactionStep.DISBURSEMENT as any,
        status: TransactionStatus.DISBURSEMENT_IN_PROGRESS as any,
        disbursementMethod: payload.disbursementMethod as any,
        updatedAt: new Date(),
      },
    });

    await prisma.transactionStepLog.create({
      data: {
        transactionId,
        step: TransactionStep.DISBURSEMENT as any,
        status: "COMPLETED",
        data: {
          settlementReference: payload.settlementReference,
          settledBy: adminId,
          settledAt: new Date().toISOString(),
        },
        completedAt: new Date(),
      },
    });

    await prisma.transactionHistory.create({
      data: {
        transactionId,
        action: "TRANSACTION_SETTLED",
        performedBy: adminId,
        notes: payload.settlementReference,
      },
    });

    return { message: "Transaction settled successfully" };
  }
}

export const adminTransactionsService = new AdminTransactionsService();
