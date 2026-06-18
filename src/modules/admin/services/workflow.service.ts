import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";

const prisma: PrismaClient = getDatabase();

type WorkflowStatus = "PENDING" | "COMPLETED" | "REJECTED";
type WorkflowModule = "Transaction" | "Outlet Management" | "Agent";

type ListFilters = {
  status?: WorkflowStatus | "ALL";
  q?: string;
  search?: string;
  module?: WorkflowModule;
};

import { CreateWorkflowDto, UpdateWorkflowDto, ApprovalType } from "../dto/workflow.dto";

export class WorkflowService {
  private toMinutesSince(date: Date) {
    const diffMs = Date.now() - date.getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  }

  async stats() {
    const client: any = prisma as any;
    const [
      txPending,
      txCompleted,
      txRejected,
      franchisePending,
      franchiseCompleted,
      franchiseRejected,
      branchPending,
      branchCompleted,
      branchRejected,
      agentsPending,
      agentsCompleted,
    ] = await Promise.all([
      client.transaction.count({ where: { status: { notIn: ["APPROVED", "COMPLETED", "REJECTED", "VERIFICATION_COMPLETED"] } } }),
      client.transaction.count({ where: { OR: [{ status: "APPROVED" }, { status: "COMPLETED" }, { status: "VERIFICATION_COMPLETED" }] } }),
      client.transaction.count({ where: { status: "REJECTED" } }),

      client.franchise.count({ where: { status: { notIn: ["APPROVED", "ACTIVE", "REJECTED"] } } }),
      client.franchise.count({ where: { OR: [{ status: "APPROVED" }, { status: "ACTIVE" }] } }),
      client.franchise.count({ where: { status: "REJECTED" } }),

      client.branch.count({ where: { status: { notIn: ["APPROVED", "ACTIVE", "REJECTED"] } } }),
      client.branch.count({ where: { OR: [{ status: "APPROVED" }, { status: "ACTIVE" }] } }),
      client.branch.count({ where: { status: "REJECTED" } }),

      client.agent.count({ where: { isApproved: false } }),
      client.agent.count({ where: { isApproved: true } }),
    ]);

    const pending = txPending;
    const completed = txCompleted;
    const rejected = txRejected;

    return { pending, completed, rejected };
  }

  async list(filters: ListFilters = {}, page = 1, limit = 20) {
    const status = ((filters.status || "PENDING").toString().toUpperCase()) as WorkflowStatus | "ALL";
    const search = ((((filters as any) || {}).search ?? (filters.q || "") ) as string).toString().trim();
    const moduleFilter = (filters.module || "").toString();

    const client: any = prisma as any;

    const txWhere: any = {};
    const frWhere: any = {};
    const brWhere: any = {};
    const agWhere: any = {};

    if (status !== "ALL") {
      if (status === "PENDING") {
        txWhere.status = { notIn: ["APPROVED", "COMPLETED", "REJECTED", "VERIFICATION_COMPLETED"] };
        frWhere.status = { notIn: ["APPROVED", "ACTIVE", "REJECTED"] };
        brWhere.status = { notIn: ["APPROVED", "ACTIVE", "REJECTED"] };
        agWhere.isApproved = false;
      } else if (status === "COMPLETED") {
        txWhere.OR = [{ status: "APPROVED" }, { status: "COMPLETED" }, { status: "VERIFICATION_COMPLETED" }];
        frWhere.OR = [{ status: "APPROVED" }, { status: "ACTIVE" }];
        brWhere.OR = [{ status: "APPROVED" }, { status: "ACTIVE" }];
        agWhere.isApproved = true;
      } else if (status === "REJECTED") {
        txWhere.status = "REJECTED";
        frWhere.status = "REJECTED";
        brWhere.status = "REJECTED";
        agWhere.id = "__none__";
      }
    }

    const [txs, franchises, branches, agents] = await Promise.all([
      (moduleFilter && moduleFilter !== "Transaction")
        ? Promise.resolve([])
        : client.transaction.findMany({
            where: txWhere,
            orderBy: { createdAt: "desc" },
            select: {
              id: true,
              referenceNumber: true,
              status: true,
              createdAt: true,
            },
          }),
      (moduleFilter && moduleFilter !== "Outlet Management")
        ? Promise.resolve([])
        : client.franchise.findMany({
            where: frWhere,
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, status: true, createdAt: true },
          }),
      (moduleFilter && moduleFilter !== "Outlet Management")
        ? Promise.resolve([])
        : client.branch.findMany({
            where: brWhere,
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, status: true, createdAt: true },
          }),
      (moduleFilter && moduleFilter !== "Agent")
        ? Promise.resolve([])
        : client.agent.findMany({
            where: agWhere,
            orderBy: { createdAt: "desc" },
            select: { id: true, name: true, email: true, isApproved: true, createdAt: true },
          }),
    ]);

    let items: any[] = [];

    items = items.concat(
      txs.map((t: any) => {
        let displayStatus = t.status;
        let actionNeeded = t.status;
        if (t.status === "ADMIN_APPROVAL_PENDING") {
          displayStatus = "Pending";
          actionNeeded = "Approve";
        } else if (
          t.status === "VERIFICATION_COMPLETED" ||
          t.status === "APPROVED" ||
          t.status === "COMPLETED"
        ) {
          displayStatus = "Completed";
          actionNeeded = "None";
        }
        return {
          id: `${t.id}`,
          module: "Transaction",
          workflowAction: "Transaction Approval",
          actionNeeded,
          status: displayStatus,
          dateInitiated: t.createdAt,
          escalationMinutes: this.toMinutesSince(new Date(t.createdAt)),
          title: t.referenceNumber,
        };
      })
    );
    items = items.concat(
      franchises.map((f: any) => ({
        id: `franchise:${f.id}`,
        module: "Outlet Management",
        workflowAction: "Create Franchise",
        actionNeeded: f.status === "PENDING" ? "Approve" : f.status,
        status: f.status === "PENDING" ? "Pending" : f.status,
        dateInitiated: f.createdAt,
        escalationMinutes: this.toMinutesSince(new Date(f.createdAt)),
        title: f.name,
      }))
    );
    items = items.concat(
      branches.map((b: any) => ({
        id: `branch:${b.id}`,
        module: "Outlet Management",
        workflowAction: "Create Branch",
        actionNeeded: b.status === "PENDING" ? "Approve" : b.status,
        status: b.status === "PENDING" ? "Pending" : b.status,
        dateInitiated: b.createdAt,
        escalationMinutes: this.toMinutesSince(new Date(b.createdAt)),
        title: b.name,
      }))
    );
    items = items.concat(
      agents.map((a: any) => ({
        id: `agent:${a.id}`,
        module: "Agent",
        workflowAction: "Agent Onboarding",
        actionNeeded: a.isApproved ? "None" : "Approve",
        status: a.isApproved ? "Completed" : "Pending",
        dateInitiated: a.createdAt,
        escalationMinutes: this.toMinutesSince(new Date(a.createdAt)),
        title: a.name,
      }))
    );

    if (search) {
      const qLower = search.toLowerCase();
      items = items.filter(
        (it) =>
          (it.title && it.title.toLowerCase().includes(qLower)) ||
          (it.workflowAction && it.workflowAction.toLowerCase().includes(qLower)) ||
          (it.module && it.module.toLowerCase().includes(qLower))
      );
    }

    const total = items.length;
    const start = (page - 1) * limit;
    const data = items.slice(start, start + limit);

    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createTemplate(payload: CreateWorkflowDto, adminId: string) {
    const client: any = prisma as any;
    const template = await client.workflowTemplate.create({
      data: {
        name: payload.name,
        description: payload.description || null,
        type: payload.type,
        approvalType: payload.approvalType || "TRANSACTION",
        minAmount: payload.minAmount !== undefined ? payload.minAmount : null,
        maxAmount: payload.maxAmount !== undefined ? payload.maxAmount : null,
        processType: payload.processType || "RIGID_LINEAR",
        action: payload.action || "Transaction Approval",
        branchId: payload.branchId || null,
        departmentId: payload.departmentId || null,
        escalationMinutes: payload.escalationMinutes || 0,
        hasPtaRequest: !!payload.hasPtaRequest,
        status: "ACTIVE",
        createdBy: adminId,
      },
      select: { id: true, name: true, type: true, status: true },
    });
    if (Array.isArray(payload.stages) && payload.stages.length) {
      for (const st of payload.stages) {
        const stage = await client.workflowStage.create({
          data: {
            templateId: template.id,
            name: st.name || `Stage ${st.order}`,
            type: st.type || null,
            escalationMinutes: st.escalationMinutes || 0,
            escalationAdminId: st.escalationAdminId || null,
            order: st.order,
          },
          select: { id: true },
        });
        if (Array.isArray(st.assignees)) {
          for (const ass of st.assignees) {
            await client.workflowAssignee.create({
              data: {
                stageId: stage.id,
                adminId: ass.adminId,
                order: ass.order || 1,
              },
            });
          }
        }
      }
    }
    return { id: template.id, message: "Workflow created" };
  }

  async saveDraft(payload: CreateWorkflowDto, adminId: string) {
    const client: any = prisma as any;
    const template = await client.workflowTemplate.create({
      data: {
        name: payload.name,
        description: payload.description || null,
        type: payload.type,
        approvalType: payload.approvalType || "TRANSACTION",
        minAmount: payload.minAmount !== undefined ? payload.minAmount : null,
        maxAmount: payload.maxAmount !== undefined ? payload.maxAmount : null,
        processType: payload.processType || "RIGID_LINEAR",
        action: payload.action || "Transaction Approval",
        branchId: payload.branchId || null,
        departmentId: payload.departmentId || null,
        escalationMinutes: payload.escalationMinutes || 0,
        hasPtaRequest: !!payload.hasPtaRequest,
        status: "DRAFT",
        createdBy: adminId,
      },
      select: { id: true, name: true, type: true },
    });
    if (Array.isArray(payload.stages) && payload.stages.length) {
      for (const st of payload.stages) {
        const stage = await client.workflowStage.create({
          data: {
            templateId: template.id,
            name: st.name || `Stage ${st.order}`,
            type: st.type || null,
            escalationMinutes: st.escalationMinutes || 0,
            escalationAdminId: st.escalationAdminId || null,
            order: st.order,
          },
          select: { id: true },
        });
        if (Array.isArray(st.assignees)) {
          for (const ass of st.assignees) {
            await client.workflowAssignee.create({
              data: {
                stageId: stage.id,
                adminId: ass.adminId,
                order: ass.order || 1,
              },
            });
          }
        }
      }
    }
    return { id: template.id, message: "Draft saved" };
  }

  async listTemplates(status: string | undefined, page = 1, limit = 20) {
    const client: any = prisma as any;
    const where: any = {};
    if (status && status !== "ALL") where.status = status.toUpperCase();
    const [total, templates] = await Promise.all([
      client.workflowTemplate.count({ where }),
      client.workflowTemplate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, type: true, status: true, createdAt: true },
      }),
    ]);
    return { data: templates, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async getTemplate(id: string) {
    const client: any = prisma as any;
    const tpl = await client.workflowTemplate.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        description: true,
        type: true,
        approvalType: true,
        minAmount: true,
        maxAmount: true,
        processType: true,
        action: true,
        status: true,
        escalationMinutes: true,
        hasPtaRequest: true,
        departmentId: true,
        branchId: true,
        createdAt: true,
        branch: { select: { name: true } },
        department: { select: { name: true } },
      },
    });

    if (!tpl) return null;

    const stages = await client.workflowStage.findMany({
      where: { templateId: id },
      orderBy: { order: "asc" },
      select: {
        id: true,
        name: true,
        type: true,
        escalationMinutes: true,
        escalationAdminId: true,
        order: true,
        escalationAdmin: {
          select: { id: true, fullName: true, email: true }
        }
      },
    });
    const stageIds = stages.map((s: any) => s.id);
    const assignees = stageIds.length
      ? await client.workflowAssignee.findMany({
          where: { stageId: { in: stageIds } },
          select: { 
            stageId: true, 
            adminId: true, 
            order: true,
            admin: { select: { fullName: true, email: true, sequenceId: true, role: { select: { name: true } } } }
          },
          orderBy: { order: "asc" },
        })
      : [];
    const stageWithAssignees = stages.map((s: any) => ({
      ...s,
      assignees: assignees
        .filter((a: any) => a.stageId === s.id)
        .map((a: any) => ({ 
          adminId: a.adminId, 
          order: a.order,
          adminName: a.admin?.fullName,
          adminEmail: a.admin?.email,
          seqid: a.admin?.sequenceId,
          roleName: a.admin?.role?.name
        })),
    }));

    const responseTpl: any = { ...tpl };
    responseTpl.branchName = tpl.branch?.name;
    responseTpl.departmentName = tpl.department?.name;
    delete responseTpl.branch;
    delete responseTpl.department;
    
    responseTpl.status =
      tpl.status === "ACTIVE" ? "Active" : tpl.status === "ARCHIVED" ? "Deactivated" : "Draft";

    return { ...responseTpl, stages: stageWithAssignees };
  }

  async updateTemplate(id: string, payload: UpdateWorkflowDto) {
    const client: any = prisma as any;
    
    // Update template metadata
    await client.workflowTemplate.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description || null,
        type: payload.type,
        approvalType: payload.approvalType || "TRANSACTION",
        minAmount: payload.minAmount !== undefined ? payload.minAmount : null,
        maxAmount: payload.maxAmount !== undefined ? payload.maxAmount : null,
        processType: payload.processType || "RIGID_LINEAR",
        action: payload.action || "Transaction Approval",
        branchId: payload.branchId || null,
        departmentId: payload.departmentId || null,
        escalationMinutes: payload.escalationMinutes || 0,
        hasPtaRequest: !!payload.hasPtaRequest,
      },
    });

    if (Array.isArray(payload.stages)) {
      const existingStages = await client.workflowStage.findMany({
        where: { templateId: id },
        select: { id: true }
      });
      const existingStageIds: string[] = existingStages.map((s: any) => s.id);
      const incomingStageIds = payload.stages.map(s => s.id).filter(Boolean) as string[];

      // Delete stages that are no longer present
      const stagesToDelete = existingStageIds.filter((sid: string) => !incomingStageIds.includes(sid));
      if (stagesToDelete.length > 0) {
        await client.workflowStage.deleteMany({
          where: { id: { in: stagesToDelete } }
        });
      }

      for (const st of payload.stages) {
        let stageId = st.id;
        
        if (stageId) {
          // Update existing stage
          await client.workflowStage.update({
            where: { id: stageId },
            data: {
              name: st.name || `Stage ${st.order}`,
              type: st.type || null,
              escalationMinutes: st.escalationMinutes || 0,
              escalationAdminId: st.escalationAdminId || null,
              order: st.order,
            }
          });
        } else {
          // Create new stage
          const newStage = await client.workflowStage.create({
            data: {
              templateId: id,
              name: st.name || `Stage ${st.order}`,
              type: st.type || null,
              escalationMinutes: st.escalationMinutes || 0,
              escalationAdminId: st.escalationAdminId || null,
              order: st.order,
            },
            select: { id: true }
          });
          stageId = newStage.id;
        }

        // Sync assignees for this stage
        if (Array.isArray(st.assignees)) {
          // For assignees, we can safely delete and recreate since no other entities link to assignee IDs
          await client.workflowAssignee.deleteMany({ where: { stageId } });
          for (const ass of st.assignees) {
            await client.workflowAssignee.create({
              data: {
                stageId,
                adminId: ass.adminId,
                order: ass.order || 1,
              },
            });
          }
        }
      }
    }
    return { id, message: "Workflow updated successfully" };
  }

  async publishTemplate(id: string) {
    const client: any = prisma as any;
    await client.workflowTemplate.update({
      where: { id },
      data: { status: "ACTIVE" },
    });
    return { id, message: "Workflow published" };
  }

  private displayId(id: string) {
    const tail = id.replace(/[^a-f0-9]/gi, "").slice(-4);
    const num = parseInt(tail || "0", 16);
    return String(num).padStart(4, "0");
  }

  async managementStats() {
    const client: any = prisma as any;
    const [total, active, archived] = await Promise.all([
      client.workflowTemplate.count(),
      client.workflowTemplate.count({ where: { status: "ACTIVE" } }),
      client.workflowTemplate.count({ where: { status: "ARCHIVED" } }),
    ]);
    return {
      totalWorkflows: total,
      activeWorkflows: active,
      deactivatedWorkflows: archived,
    };
  }

  async managementList(filters: { q?: string; status?: string; search?: string }, page = 1, limit = 20) {
    const client: any = prisma as any;
    const where: any = {};
    if (filters.status && filters.status !== "ALL") {
      if (filters.status.toUpperCase() === "DEACTIVATED") where.status = "ARCHIVED";
      else where.status = filters.status.toUpperCase();
    }
    const s = ((((filters as any) || {}).search ?? (filters.q || "") ) as string).toString().trim();
    if (s) {
      where.OR = [
        { name: { contains: s, mode: "insensitive" } },
      ];
    }
    const [templates, total] = await Promise.all([
      client.workflowTemplate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, name: true, type: true, status: true, createdAt: true, approvalType: true },
      }),
      client.workflowTemplate.count({ where }),
    ]);
    const ids = templates.map((t: any) => t.id);
    const stages = ids.length
      ? await client.workflowStage.findMany({
          where: { templateId: { in: ids } },
          select: { id: true, templateId: true },
        })
      : [];
    const stageCount: Record<string, number> = {};
    stages.forEach((s: any) => {
      stageCount[s.templateId] = (stageCount[s.templateId] || 0) + 1;
    });
    const data = templates.map((t: any) => {
      const workflowType = t.processType === "FLEXIBLE" ? "Flexible Workflow" : "Rigid Linear";
      const statusLabel =
        t.status === "ACTIVE" ? "Active" : t.status === "ARCHIVED" ? "Deactivated" : "Draft";
      return {
        id: t.id,
        displayId: this.displayId(t.id),
        workflowName: t.name,
        workflowType,
        workflowAction: t.action || "Transaction Management",
        status: statusLabel,
        dateCreated: t.createdAt,
        approvalType: t.approvalType,
      };
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async setTemplateStatus(id: string, action: "ACTIVATE" | "DEACTIVATE") {
    const client: any = prisma as any;
    const status = action === "ACTIVATE" ? "ACTIVE" : "ARCHIVED";
    await client.workflowTemplate.update({ where: { id }, data: { status } });
    return { id, status };
  }

  async exportTemplates(filters: { status?: string; q?: string; search?: string }, requestedBy: string) {
    const client: any = prisma as any;
    const job = await client.reportJob.create({
      data: {
        module: "WORKFLOW",
        format: "CSV",
        startDate: new Date(0),
        endDate: new Date(),
        requestedBy,
        status: "PENDING",
        metadata: filters || {},
      },
      select: { id: true, status: true },
    });
    return { jobId: job.id, status: job.status };
  }

  async findApplicableWorkflow(params: {
    branchId?: string;
    departmentId?: string;
    action?: string;
    approvalType?: ApprovalType | string;
    amount?: number;
  }) {
    const client: any = prisma as any;
    // Find active templates that match the criteria
    // Priority: Branch + Department > Branch > Department > Generic
    
    const where: any = {
      status: "ACTIVE",
    };

    if (params.approvalType) {
      where.approvalType = params.approvalType;
    } else {
      where.OR = [
        { action: params.action || "Transaction Approval" },
        { action: null },
        { action: "" }
      ];
    }

    if (params.amount !== undefined && params.amount !== null) {
      where.AND = [
        {
          OR: [
            { minAmount: null },
            { minAmount: { lte: params.amount } }
          ]
        },
        {
          OR: [
            { maxAmount: null },
            { maxAmount: { gte: params.amount } }
          ]
        }
      ];
    }

    const templates = await client.workflowTemplate.findMany({
      where,
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: { 
            escalationAdmin: {
              select: { id: true, fullName: true, email: true }
            },
            assignees: {
              include: {
                admin: {
                  select: { id: true, fullName: true, role: { select: { name: true } } }
                }
              }
            } 
          },
        },
      },
    });

    if (!templates.length) return null;

    // Filter and score
    const scored = templates.map((t: any) => {
      let score = 0;
      
      const tBranchId = t.branchId || null;
      const pBranchId = params.branchId || null;
      if (tBranchId === pBranchId && pBranchId !== null) {
        score += 10;
      } else if (tBranchId !== null && tBranchId !== pBranchId) {
        if (pBranchId === null) {
           score -= 1; // Soft penalty for customer transactions
        } else {
           score -= 2; // Soft penalty for different branch (fallback allowed)
        }
      }

      const tDeptId = t.departmentId || null;
      const pDeptId = params.departmentId || null;
      if (tDeptId === pDeptId && pDeptId !== null) {
        score += 5;
      } else if (tDeptId !== null && tDeptId !== pDeptId) {
        if (pDeptId === null) {
           score -= 1; // Soft penalty
        } else {
           score -= 2; // Soft penalty for different department (fallback allowed)
        }
      }

      return { t, score };
    });

    const best = scored.sort((a: any, b: any) => b.score - a.score)[0];
    return best && best.score > -100 ? best.t : null;
  }

  /**
   * Attaches an applicable workflow template to a transaction if not already attached.
   */
  async attachWorkflowToTransaction(transactionId: string) {
    const client: any = prisma as any;
    
    const tx = await client.transaction.findUnique({
      where: { id: transactionId },
      include: {
        createdByAgent: {
          select: { branchId: true }
        }
      }
    });
    
    if (!tx || tx.workflowTemplateId) return null; // Already attached or not found

    const template = await this.findApplicableWorkflow({
      branchId: tx.createdByAgent?.branchId || undefined,
      approvalType: "TRANSACTION",
      amount: Number(tx.nairaEquivalent || tx.foreignAmount || 0),
    });

    if (!template || !template.stages || template.stages.length === 0) {
      return null;
    }

    const firstStage = template.stages[0];

    const updated = await client.transaction.update({
      where: { id: transactionId },
      data: {
        workflowTemplateId: template.id,
        currentWorkflowStageId: firstStage.id,
      }
    });

    return updated;
  }

  /**
   * Attaches an applicable REFUND workflow template to a transaction, overriding its previous workflow.
   */
  async attachRefundWorkflowToTransaction(transactionId: string) {
    const client: any = prisma as any;

    const tx = await client.transaction.findUnique({
      where: { id: transactionId },
      include: {
        createdByAgent: {
          select: { branchId: true }
        }
      }
    });

    if (!tx) return null;

    const template = await this.findApplicableWorkflow({
      branchId: tx.createdByAgent?.branchId || undefined,
      approvalType: "REFUND",
      amount: Number(tx.nairaEquivalent || tx.foreignAmount || 0),
    });

    if (!template || !template.stages || template.stages.length === 0) {
      return null;
    }

    const firstStage = template.stages[0];

    await client.transaction.update({
      where: { id: transactionId },
      data: {
        workflowTemplateId: template.id,
        currentWorkflowStageId: firstStage.id,
      }
    });

    return template;
  }

  /**
   * Attaches an applicable workflow template to a wallet entry refund if not already attached.
   */
  async attachWorkflowToRefund(entryId: string) {
    const client: any = prisma as any;
    
    const entry = await client.walletEntry.findUnique({
      where: { id: entryId },
    });
    
    if (!entry || entry.workflowTemplateId) return null; // Already attached or not found

    const template = await this.findApplicableWorkflow({
      approvalType: "REFUND",
      amount: Number(entry.amount || 0),
    });

    if (!template || !template.stages || template.stages.length === 0) {
      return null;
    }

    const firstStage = template.stages[0];

    const updated = await client.walletEntry.update({
      where: { id: entryId },
      data: {
        workflowTemplateId: template.id,
        currentWorkflowStageId: firstStage.id,
        refundStatus: "PENDING_APPROVAL",
      }
    });

    return updated;
  }

  /**
   * Attaches an applicable workflow template to an exchange rate if not already attached.
   */
  async attachWorkflowToRate(rateId: string) {
    const client: any = prisma as any;
    
    const rate = await client.exchangeRate.findUnique({
      where: { id: rateId },
    });
    
    if (!rate || rate.workflowTemplateId) return null; // Already attached or not found

    const template = await this.findApplicableWorkflow({
      approvalType: "RATE",
    });

    if (!template || !template.stages || template.stages.length === 0) {
      return null;
    }

    const firstStage = template.stages[0];

    const updated = await client.exchangeRate.update({
      where: { id: rateId },
      data: {
        workflowTemplateId: template.id,
        currentWorkflowStageId: firstStage.id,
        isApproved: false,
        isActive: false, // Inactive until approved
      }
    });

    return updated;
  }

  async getActiveWorkflowState(
    entity: { 
      workflowTemplateId?: string | null; 
      currentWorkflowStageId?: string | null; 
      isApproved?: boolean | null; 
      refundStatus?: string | null; 
    },
    adminId?: string
  ) {
    const client: any = prisma as any;
    let isApprovalOfficer = false;
    let approvalState: string | null = null;
    let pendingAssignees: any[] = [];
    let workflow = null;

    if (entity.workflowTemplateId) {
      workflow = await client.workflowTemplate.findUnique({
        where: { id: entity.workflowTemplateId },
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

    let activeStage: any = null;
    const isCompleted = entity.isApproved === true || entity.refundStatus === "COMPLETED";
    const isFailed = entity.refundStatus === "FAILED";

    if (workflow) {
      if (adminId) {
        isApprovalOfficer = workflow.stages.some((s: any) => 
          s.assignees.some((a: any) => String(a.adminId).toLowerCase() === String(adminId).toLowerCase())
        );
      }

      if (entity.currentWorkflowStageId) {
        activeStage = workflow.stages.find((s: any) => s.id === entity.currentWorkflowStageId);
      } 
      
      if (!activeStage && workflow.stages.length > 0 && !isCompleted && !isFailed) {
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
      } else if (isCompleted) {
        approvalState = "Approved (Workflow Completed)";
      } else if (isFailed) {
        approvalState = "Rejected/Failed (Workflow Completed)";
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
      name: workflow?.name || null,
      approvalType: workflow?.approvalType || null,
      isApprovalOfficer,
      approvalState,
      pendingAssignees,
      workflowStages,
    };
  }

  async listStageTypes() {
    const client: any = prisma as any;
    return client.workflowStageType.findMany({
      orderBy: { name: "asc" },
    });
  }

  async createStageType(name: string, description?: string) {
    const client: any = prisma as any;
    const formattedName = name.trim().toUpperCase();
    if (!formattedName) throw new Error("Stage type name is required");

    const existing = await client.workflowStageType.findUnique({
      where: { name: formattedName },
    });
    if (existing) throw new Error(`Stage type ${formattedName} already exists`);

    return client.workflowStageType.create({
      data: {
        name: formattedName,
        description: description || null,
      },
    });
  }

  async updateStageType(id: string, name: string, description?: string) {
    const client: any = prisma as any;
    const formattedName = name.trim().toUpperCase();
    if (!formattedName) throw new Error("Stage type name is required");

    const existing = await client.workflowStageType.findUnique({
      where: { name: formattedName },
    });
    if (existing && existing.id !== id) {
      throw new Error(`Stage type ${formattedName} is already in use by another record`);
    }

    return client.workflowStageType.update({
      where: { id },
      data: {
        name: formattedName,
        description: description !== undefined ? description : null,
      },
    });
  }

  async deleteStageType(id: string) {
    const client: any = prisma as any;
    // Check if any workflow stage is using this stage type name
    const stageType = await client.workflowStageType.findUnique({
      where: { id },
    });
    if (!stageType) throw new Error("Stage type not found");

    const inUseStage = await client.workflowStage.findFirst({
      where: { type: stageType.name },
    });
    const inUseTemplate = await client.workflowTemplate.findFirst({
      where: { type: stageType.name },
    });

    if (inUseStage || inUseTemplate) {
      throw new Error(`Cannot delete stage type ${stageType.name} because it is in use by active workflows`);
    }

    return client.workflowStageType.delete({
      where: { id },
    });
  }
}

export const workflowService = new WorkflowService();
