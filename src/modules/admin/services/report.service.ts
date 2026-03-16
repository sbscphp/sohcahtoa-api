import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { buildCsv } from "../../../shared/utils/csv";

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

  private escapePdfString(input: string): string {
    return (input || "").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
  }

  private buildSimplePdf(lines: string[]): Buffer {
    const pageWidth = 612;
    const pageHeight = 792;
    const marginLeft = 48;
    const topY = 760;
    const lineHeight = 14;
    const maxLines = Math.floor((topY - 48) / lineHeight);

    const safeLines = (lines || []).slice(0, Math.max(0, maxLines));
    const contentOps: string[] = [];
    if (safeLines.length > 0) {
      contentOps.push(`${marginLeft} ${topY} Td (${this.escapePdfString(safeLines[0])}) Tj`);
      for (let i = 1; i < safeLines.length; i++) {
        contentOps.push(`0 -${lineHeight} Td (${this.escapePdfString(safeLines[i])}) Tj`);
      }
    }

    const stream = `BT\n/F1 10 Tf\n${contentOps.join("\n")}\nET\n`;

    const objects: string[] = [];
    objects.push("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
    objects.push("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
    objects.push(
      `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>\nendobj\n`
    );
    objects.push(`4 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}endstream\nendobj\n`);
    objects.push("5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");

    let pdf = "%PDF-1.4\n";
    const offsets: number[] = [0];
    for (const obj of objects) {
      offsets.push(Buffer.byteLength(pdf, "utf8"));
      pdf += obj;
    }

    const xrefStart = Buffer.byteLength(pdf, "utf8");
    pdf += "xref\n0 6\n";
    pdf += "0000000000 65535 f \n";
    for (let i = 1; i <= 5; i++) {
      const off = offsets[i];
      pdf += `${String(off).padStart(10, "0")} 00000 n \n`;
    }
    pdf += "trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n";
    pdf += `${xrefStart}\n%%EOF\n`;

    return Buffer.from(pdf, "utf8");
  }

  async buildGeneratedReport(params: { module: string; startDate: Date; endDate: Date }) {
    const where: any = {
      performedAt: { gte: params.startDate, lte: params.endDate },
    };

    const moduleKey = (params.module || "").toString().toUpperCase();
    if (moduleKey === "INCIDENT") {
      where.resourceType = "INCIDENCE";
    } else if (moduleKey === "FRANCHISE") {
      where.resourceType = "OUTLET";
      where.actionType = { startsWith: "FRANCHISE_" };
    } else if (moduleKey === "OUTLET") {
      where.resourceType = "OUTLET";
    } else if (moduleKey === "BRANCH") {
      where.resourceType = "BRANCH";
    } else if (moduleKey === "AGENT") {
      where.resourceType = "AGENT";
    } else if (moduleKey === "RATE") {
      where.resourceType = "RATE";
    } else if (moduleKey === "TRANSACTION") {
      where.resourceType = "TRANSACTION";
    } else if (moduleKey === "WORKFLOW") {
      where.resourceType = "WORKFLOW";
    } else {
      where.resourceType = moduleKey;
    }

    const rows = await (prisma as any).adminAction.findMany({
      where,
      orderBy: { performedAt: "desc" },
      take: 10_000,
      select: {
        performedAt: true,
        actionType: true,
        actionLabel: true,
        resourceType: true,
        resourceId: true,
        status: true,
        reason: true,
        admin: { select: { fullName: true, email: true } },
      },
    });

    const data = (rows || []).map((r: any) => ({
      performedAt: r.performedAt,
      adminName: r.admin?.fullName || r.admin?.email || "",
      actionType: r.actionType || "",
      actionLabel: r.actionLabel || "",
      resourceType: r.resourceType || "",
      resourceId: r.resourceId || "",
      status: r.status || "",
      reason: r.reason || "",
    }));

    const columns = [
      { header: "Performed At", select: (r: any) => r.performedAt },
      { header: "Admin", select: (r: any) => r.adminName },
      { header: "Action Type", select: (r: any) => r.actionType },
      { header: "Action Label", select: (r: any) => r.actionLabel },
      { header: "Resource Type", select: (r: any) => r.resourceType },
      { header: "Resource ID", select: (r: any) => r.resourceId },
      { header: "Status", select: (r: any) => r.status },
      { header: "Reason", select: (r: any) => r.reason },
    ];

    const filenameBase = `${moduleKey.toLowerCase()}-${params.startDate.toISOString().slice(0, 10)}-${params.endDate.toISOString().slice(0, 10)}`;

    const csv = buildCsv(columns as any, data as any);

    const pdfLines = [
      `${moduleKey} report`,
      `Date range: ${params.startDate.toISOString()} - ${params.endDate.toISOString()}`,
      "",
      "Performed At | Admin | Action Label | Status | Resource ID",
      ...data.map((r: any) => {
        const ts = r.performedAt ? new Date(r.performedAt).toISOString() : "";
        const admin = (r.adminName || "").slice(0, 40);
        const label = (r.actionLabel || "").slice(0, 50);
        const status = (r.status || "").slice(0, 20);
        const rid = (r.resourceId || "").slice(0, 36);
        return `${ts} | ${admin} | ${label} | ${status} | ${rid}`;
      }),
    ];

    const pdf = this.buildSimplePdf(pdfLines);

    return { filenameBase, csv, pdf, rowCount: data.length };
  }

  async generate(data: { module: string; startDate: Date; endDate: Date; format: "CSV" | "PDF"; requestedBy: string; metadata?: any }) {
    const client: any = prisma as any;
    const reportName = `${data.module} report`;
    const job = await client.reportJob.create({
      data: {
        module: data.module,
        format: data.format,
        startDate: data.startDate,
        endDate: data.endDate,
        requestedBy: data.requestedBy,
        status: "COMPLETED",
        generatedUrl: null,
        metadata: { reportName, ...(data.metadata || {}) },
        completedAt: new Date(),
      },
    });
    return job;
  }
}

export const reportService = new ReportService();
