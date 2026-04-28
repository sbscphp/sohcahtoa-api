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

import { CreateWorkflowDto, UpdateWorkflowDto } from "../dto/workflow.dto";

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
      client.transaction.count({ where: { status: "ADMIN_APPROVAL_PENDING" } }),
      client.transaction.count({ where: { OR: [{ status: "APPROVED" }, { status: "COMPLETED" }] } }),
      client.transaction.count({ where: { status: "REJECTED" } }),

      client.franchise.count({ where: { status: "PENDING" } }),
      client.franchise.count({ where: { OR: [{ status: "APPROVED" }, { status: "ACTIVE" }] } }),
      client.franchise.count({ where: { status: "REJECTED" } }),

      client.branch.count({ where: { status: "PENDING" } }),
      client.branch.count({ where: { OR: [{ status: "APPROVED" }, { status: "ACTIVE" }] } }),
      client.branch.count({ where: { status: "REJECTED" } }),

      client.agent.count({ where: { isApproved: false } }),
      client.agent.count({ where: { isApproved: true } }),
    ]);

    const pending = txPending + franchisePending + branchPending + agentsPending;
    const completed = txCompleted + franchiseCompleted + branchCompleted + agentsCompleted;
    const rejected = txRejected + franchiseRejected + branchRejected;

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
        txWhere.status = "ADMIN_APPROVAL_PENDING";
        frWhere.status = "PENDING";
        brWhere.status = "PENDING";
        agWhere.isApproved = false;
      } else if (status === "COMPLETED") {
        txWhere.OR = [{ status: "APPROVED" }, { status: "COMPLETED" }];
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
              type: true,
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
      txs.map((t: any) => ({
        id: `transaction:${t.id}`,
        module: "Transaction",
        workflowAction: "Transaction Approval",
        actionNeeded: t.status === "ADMIN_APPROVAL_PENDING" ? "Approve" : t.status,
        status: t.status === "ADMIN_APPROVAL_PENDING" ? "Pending" : t.status,
        dateInitiated: t.createdAt,
        escalationMinutes: this.toMinutesSince(new Date(t.createdAt)),
        title: t.referenceNumber,
        subtype: t.type,
      }))
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
        processType: payload.processType || "RIGID_LINEAR",
        action: payload.action || null,
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
        processType: payload.processType || "RIGID_LINEAR",
        action: payload.action || null,
        branchId: payload.branchId || null,
        departmentId: payload.departmentId || null,
        escalationMinutes: payload.escalationMinutes || 0,
        hasPtaRequest: !!payload.hasPtaRequest,
        status: "DRAFT",
        createdBy: adminId,
      },
      select: { id: true },
    });
    if (Array.isArray(payload.stages) && payload.stages.length) {
      for (const st of payload.stages) {
        const stage = await client.workflowStage.create({
          data: {
            templateId: template.id,
            name: st.name || `Stage ${st.order}`,
            type: st.type || null,
            escalationMinutes: st.escalationMinutes || 0,
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
    if (status && status !== "ALL") where.status = { equals: status, mode: "insensitive" };
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
      select: { id: true, name: true, type: true, escalationMinutes: true, order: true },
    });
    const stageIds = stages.map((s: any) => s.id);
    const assignees = stageIds.length
      ? await client.workflowAssignee.findMany({
          where: { stageId: { in: stageIds } },
          select: { 
            stageId: true, 
            adminId: true, 
            order: true,
            admin: { select: { fullName: true, role: { select: { name: true } } } }
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
          roleName: a.admin?.role?.name
        })),
    }));

    const responseTpl: any = { ...tpl };
    responseTpl.branchName = tpl.branch?.name;
    responseTpl.departmentName = tpl.department?.name;
    delete responseTpl.branch;
    delete responseTpl.department;

    return { ...responseTpl, stages: stageWithAssignees };
  }

  async updateTemplate(id: string, payload: UpdateWorkflowDto) {
    const client: any = prisma as any;
    await client.workflowTemplate.update({
      where: { id },
      data: {
        name: payload.name,
        description: payload.description || null,
        type: payload.type,
        processType: payload.processType || "RIGID_LINEAR",
        action: payload.action || null,
        branchId: payload.branchId || null,
        departmentId: payload.departmentId || null,
        escalationMinutes: payload.escalationMinutes || 0,
        hasPtaRequest: !!payload.hasPtaRequest,
      },
    });
    if (Array.isArray(payload.stages)) {
      await client.workflowStage.deleteMany({ where: { templateId: id } });
      for (const st of payload.stages) {
        const stage = await client.workflowStage.create({
          data: {
            templateId: id,
            name: st.name || `Stage ${st.order}`,
            type: st.type || null,
            escalationMinutes: st.escalationMinutes || 0,
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
    return { id, message: "Workflow updated" };
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
      if (filters.status.toUpperCase() === "DEACTIVATED") where.status = { equals: "ARCHIVED", mode: "insensitive" };
      else where.status = { equals: filters.status, mode: "insensitive" };
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
        select: { id: true, name: true, type: true, status: true, createdAt: true },
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
        workflowAction: t.action || (t.type === "APPROVAL" ? "Transaction Management" : "Settlement Management"),
        status: statusLabel,
        dateCreated: t.createdAt,
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
    type: string;
    branchId?: string;
    departmentId?: string;
    action?: string;
  }) {
    const client: any = prisma as any;
    // Find active templates that match the criteria
    // Priority: Branch + Department > Branch > Department > Generic
    const templates = await client.workflowTemplate.findMany({
      where: {
        status: "ACTIVE",
        action: params.action || "Transaction Approval", // Default action name
      },
      include: {
        stages: {
          orderBy: { order: "asc" },
          include: { assignees: true },
        },
      },
    });

    if (!templates.length) return null;

    // Filter and score
    const scored = templates.map((t: any) => {
      let score = 0;
      if (t.branchId === params.branchId) score += 10;
      else if (t.branchId && t.branchId !== params.branchId) score -= 100;

      if (t.departmentId === params.departmentId) score += 5;
      else if (t.departmentId && t.departmentId !== params.departmentId) score -= 100;

      return { t, score };
    });

    const best = scored.sort((a: any, b: any) => b.score - a.score)[0];
    return best.score >= 0 ? best.t : null;
  }
}

export const workflowService = new WorkflowService();
