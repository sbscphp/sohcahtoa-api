import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";

const prisma: PrismaClient = getDatabase();

type WorkflowStatus = "PENDING" | "COMPLETED" | "REJECTED";
type WorkflowModule = "Transaction" | "Outlet Management" | "Agent";

type ListFilters = {
  status?: WorkflowStatus | "ALL";
  q?: string;
  module?: WorkflowModule;
};

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
    const q = (filters.q || "").toString().trim();
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

    if (q) {
      const qLower = q.toLowerCase();
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
}

export const workflowService = new WorkflowService();
