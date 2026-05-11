import PDFDocument from "pdfkit";
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

  private async normalizeModule(input: string): Promise<string> {
    const modules = await this.modules();
    const normalizedInput = input.trim().toUpperCase();

    // Find module by key or name
    const module = modules.find(
      (m) => m.key === normalizedInput || m.name.toUpperCase() === normalizedInput,
    );

    return module ? module.key : normalizedInput;
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
    if (filters.module) where.module = { equals: filters.module, mode: "insensitive" };
    if (filters.status) where.status = { equals: filters.status, mode: "insensitive" };
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

  private async generateProfessionalPdf(params: {
    title: string;
    columns: { header: string; width: number }[];
    rows: string[][];
    dateRange: string;
  }): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        margin: 50,
        size: "A4",
        bufferPages: true,
      });
      const chunks: Buffer[] = [];

      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err: Error) => reject(err));

      // Colors
      const primaryColor = "#0f172a"; // Deep Navy
      const secondaryColor = "#64748b"; // Slate
      const borderColor = "#e2e8f0";
      const tableHeaderBg = "#f8fafc";
      const zebraBg = "#fbfcfe";

      const drawHeader = () => {
        // Top accent bar
        doc.rect(0, 0, doc.page.width, 50).fill(primaryColor);
        doc.fillColor("#ffffff").fontSize(16).font("Helvetica-Bold")
          .text("SOHCAHTOA", 50, 18);
        doc.fontSize(8).font("Helvetica")
          .text("ADMIN MANAGEMENT SYSTEM", 150, 24, { characterSpacing: 1 });

        // Report Title & Info
        doc.fillColor(primaryColor).fontSize(22).font("Helvetica-Bold")
          .text(params.title.toUpperCase(), 50, 80);

        doc.fontSize(9).fillColor(secondaryColor).font("Helvetica")
          .text(`Date Range: ${params.dateRange}`, 50, 110);
        doc.text(`Generated On: ${new Date().toLocaleString()}`, 50, 125);

        // Divider
        doc.moveTo(50, 145).lineTo(550, 145).strokeColor(borderColor).lineWidth(0.5).stroke();
      };

      const drawTableHeader = (y: number) => {
        doc.rect(50, y, 500, 25).fill(tableHeaderBg);
        doc.fillColor(primaryColor).fontSize(9).font("Helvetica-Bold");
        let currentX = 50;
        params.columns.forEach((col) => {
          doc.text(col.header.toUpperCase(), currentX + 8, y + 8, {
            width: col.width - 16,
            align: "left",
          });
          currentX += col.width;
        });

        // Header Bottom Border
        doc.moveTo(50, y + 25).lineTo(550, y + 25).strokeColor(borderColor).lineWidth(1).stroke();
        return y + 25;
      };

      // Initial page setup
      drawHeader();
      let currentY = 160;
      currentY = drawTableHeader(currentY);

      // Rows
      doc.font("Helvetica").fontSize(8).fillColor("#334155");

      params.rows.forEach((row, i) => {
        // Calculate required row height based on content
        let maxRowHeight = 22;
        row.forEach((cell, cellIndex) => {
          const cellWidth = params.columns[cellIndex].width - 16;
          const textHeight = doc.heightOfString(cell || "", { width: cellWidth });
          if (textHeight + 12 > maxRowHeight) maxRowHeight = textHeight + 12;
        });

        // Check for page break (margin 750)
        if (currentY + maxRowHeight > 750) {
          doc.addPage();
          drawHeader();
          currentY = 160;
          currentY = drawTableHeader(currentY);
          doc.font("Helvetica").fontSize(8).fillColor("#334155");
        }

        // Zebra striping
        if (i % 2 === 1) {
          doc.rect(50, currentY, 500, maxRowHeight).fill(zebraBg);
        }

        // Draw cell content
        doc.fillColor("#334155");
        let cellX = 50;
        row.forEach((cell, cellIndex) => {
          doc.text(cell || "", cellX + 8, currentY + 7, {
            width: params.columns[cellIndex].width - 16,
            lineBreak: true,
          });
          cellX += params.columns[cellIndex].width;
        });

        // Row bottom border
        doc.moveTo(50, currentY + maxRowHeight)
          .lineTo(550, currentY + maxRowHeight)
          .strokeColor(borderColor)
          .lineWidth(0.5)
          .stroke();

        currentY += maxRowHeight;
      });

      // Footer numbering (buffered)
      const pages = (doc as any).bufferedPageRange();
      for (let i = 0; i < pages.count; i++) {
        doc.switchToPage(i);
        doc.moveTo(50, 780).lineTo(550, 780).strokeColor(borderColor).lineWidth(0.5).stroke();
        doc.fontSize(7).fillColor(secondaryColor)
          .text(
            `Sohcahtoa Admin - Confidential - Page ${i + 1} of ${pages.count}`,
            50,
            785,
            { align: "center", width: 500 }
          );
      }

      doc.end();
    });
  }

  async buildGeneratedReport(params: { module: string; startDate: Date; endDate: Date }) {
    const normalizedModule = await this.normalizeModule(params.module);
    const moduleKey = (normalizedModule || "").toString().toUpperCase();
    const dateRange = { gte: params.startDate, lte: params.endDate };

    let data: any[] = [];
    let columns: { header: string; select: (r: any) => any }[] = [];
    let pdfColumns: { header: string; width: number }[] = [];
    let pdfRows: string[][] = [];

    switch (moduleKey) {
      case "TRANSACTION": {
        const rows = await (prisma as any).transaction.findMany({
          where: { createdAt: dateRange },
          orderBy: { createdAt: "desc" },
          include: { user: { include: { profile: true } } },
        });
        data = rows;
        columns = [
          { header: "Date", select: (r) => r.createdAt },
          { header: "Reference", select: (r) => r.referenceNumber },
          { header: "Customer", select: (r) => r.user?.profile ? `${r.user.profile.firstName} ${r.user.profile.lastName}` : r.user?.email },
          { header: "Type", select: (r) => r.type },
          { header: "Amount", select: (r) => r.nairaEquivalent || r.foreignAmount },
          { header: "Status", select: (r) => r.status },
        ];
        pdfColumns = [
          { header: "Date", width: 100 },
          { header: "Ref", width: 90 },
          { header: "Customer", width: 120 },
          { header: "Type", width: 70 },
          { header: "Amount", width: 60 },
          { header: "Status", width: 60 },
        ];
        pdfRows = rows.map((r: any) => [
          r.createdAt ? new Date(r.createdAt).toISOString().slice(0, 10) : "",
          r.referenceNumber || "",
          (r.user?.profile ? `${r.user.profile.firstName} ${r.user.profile.lastName}` : r.user?.email || "").slice(0, 20),
          r.type || "",
          r.nairaEquivalent?.toString() || r.foreignAmount?.toString() || "0",
          r.status || "",
        ]);
        break;
      }

      case "AGENT": {
        const rows = await (prisma as any).agent.findMany({
          where: { createdAt: dateRange },
          orderBy: { name: "asc" },
          include: { branch: true },
        });
        data = rows;
        columns = [
          { header: "Name", select: (r) => r.name },
          { header: "Email", select: (r) => r.email },
          { header: "Phone", select: (r) => r.phoneNumber },
          { header: "Branch", select: (r) => r.branch?.name },
          { header: "Status", select: (r) => (r.isActive ? "Active" : "Inactive") },
          { header: "Created At", select: (r) => r.createdAt },
        ];
        pdfColumns = [
          { header: "Name", width: 120 },
          { header: "Email", width: 130 },
          { header: "Phone", width: 90 },
          { header: "Branch", width: 100 },
          { header: "Status", width: 60 },
        ];
        pdfRows = rows.map((r: any) => [
          r.name || "",
          r.email || "",
          r.phoneNumber || "",
          r.branch?.name || "N/A",
          r.isActive ? "Active" : "Inactive",
        ]);
        break;
      }

      case "RATE": {
        const rows = await (prisma as any).exchangeRate.findMany({
          where: { createdAt: dateRange },
          orderBy: { updatedAt: "desc" },
        });
        data = rows;
        columns = [
          { header: "From", select: (r) => r.fromCurrency },
          { header: "To", select: (r) => r.toCurrency },
          { header: "Rate", select: (r) => r.rate },
          { header: "Buy", select: (r) => r.buyRate },
          { header: "Sell", select: (r) => r.sellRate },
          { header: "Valid From", select: (r) => r.validFrom },
          { header: "Valid Until", select: (r) => r.validUntil },
        ];
        pdfColumns = [
          { header: "From", width: 70 },
          { header: "To", width: 70 },
          { header: "Rate", width: 80 },
          { header: "Buy", width: 80 },
          { header: "Sell", width: 80 },
          { header: "Updated", width: 120 },
        ];
        pdfRows = rows.map((r: any) => [
          r.fromCurrency || "",
          r.toCurrency || "",
          r.rate?.toString() || "",
          r.buyRate?.toString() || "",
          r.sellRate?.toString() || "",
          r.updatedAt ? new Date(r.updatedAt).toISOString().slice(0, 16).replace("T", " ") : "",
        ]);
        break;
      }

      case "INCIDENT":
      case "TICKET": {
        const rows = await (prisma as any).ticket.findMany({
          where: { createdAt: dateRange },
          orderBy: { createdAt: "desc" },
          include: { customer: { include: { profile: true } }, assignedAgent: true },
        });
        data = rows;
        columns = [
          { header: "Ref", select: (r) => r.reference },
          { header: "Customer", select: (r) => r.customer?.profile ? `${r.customer.profile.firstName} ${r.customer.profile.lastName}` : r.customer?.email },
          { header: "Type", select: (r) => r.caseType },
          { header: "Priority", select: (r) => r.priority },
          { header: "Status", select: (r) => r.status },
          { header: "Assigned To", select: (r) => r.assignedAgent?.fullName },
        ];
        pdfColumns = [
          { header: "Ref", width: 90 },
          { header: "Customer", width: 120 },
          { header: "Type", width: 90 },
          { header: "Prio", width: 60 },
          { header: "Status", width: 60 },
          { header: "Assignee", width: 80 },
        ];
        pdfRows = rows.map((r: any) => [
          r.reference || "",
          (r.customer?.profile ? `${r.customer.profile.firstName} ${r.customer.profile.lastName}` : r.customer?.email || "").slice(0, 20),
          r.caseType || "",
          r.priority || "",
          r.status || "",
          (r.assignedAgent?.fullName || "Unassigned").slice(0, 15),
        ]);
        break;
      }

      case "OUTLET":
      case "BRANCH": {
        const rows = await (prisma as any).branch.findMany({
          where: { createdAt: dateRange },
          orderBy: { state: "asc" },
          include: { franchise: true },
        });
        data = rows;
        columns = [
          { header: "Branch Name", select: (r) => r.name },
          { header: "Email", select: (r) => r.branchEmail },
          { header: "State", select: (r) => r.state },
          { header: "Manager", select: (r) => r.branchManager },
          { header: "Franchise", select: (r) => r.franchise?.name },
          { header: "Status", select: (r) => r.status },
        ];
        pdfColumns = [
          { header: "Name", width: 120 },
          { header: "State", width: 80 },
          { header: "Manager", width: 100 },
          { header: "Franchise", width: 100 },
          { header: "Status", width: 100 },
        ];
        pdfRows = rows.map((r: any) => [
          r.name || "",
          r.state || "",
          r.branchManager || "",
          r.franchise?.name || "Independent",
          r.status || "",
        ]);
        break;
      }

      default: {
        // Fallback to AdminActions if no specific module matcher is found
        const rows = await (prisma as any).adminAction.findMany({
          where: { performedAt: dateRange, resourceType: moduleKey },
          orderBy: { performedAt: "desc" },
          include: { admin: true },
        });
        data = rows;
        columns = [
          { header: "Time", select: (r) => r.performedAt },
          { header: "Admin", select: (r) => r.admin?.fullName },
          { header: "Action", select: (r) => r.actionLabel },
          { header: "Status", select: (r) => r.status },
          { header: "Resource ID", select: (r) => r.resourceId },
        ];
        pdfColumns = [
          { header: "Time", width: 120 },
          { header: "Admin", width: 100 },
          { header: "Action", width: 140 },
          { header: "Status", width: 60 },
          { header: "ID", width: 80 },
        ];
        pdfRows = rows.map((r: any) => [
          r.performedAt ? new Date(r.performedAt).toISOString().slice(0, 19).replace("T", " ") : "",
          (r.admin?.fullName || "").slice(0, 15),
          (r.actionLabel || "").slice(0, 30),
          r.status || "",
          (r.resourceId || "").slice(0, 15),
        ]);
      }
    }

    const filenameBase = `${moduleKey.toLowerCase()}-${params.startDate.toISOString().slice(0, 10)}-${params.endDate.toISOString().slice(0, 10)}`;

    const csv = buildCsv(columns as any, data as any);

    const pdf = await this.generateProfessionalPdf({
      title: `${moduleKey} Data Report`,
      dateRange: `${params.startDate.toISOString().slice(0, 10)} to ${params.endDate.toISOString().slice(0, 10)}`,
      columns: pdfColumns,
      rows: pdfRows,
    });

    return { filenameBase, csv, pdf, rowCount: data.length };
  }

  async generate(data: {
    module: string;
    startDate: Date;
    endDate: Date;
    format: "CSV" | "PDF";
    requestedBy: string;
    metadata?: any;
  }) {
    const client: any = prisma as any;
    const normalizedModule = await this.normalizeModule(data.module);
    const reportName = `${data.module} report`;
    const job = await client.reportJob.create({
      data: {
        module: normalizedModule,
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
