import { getDatabase } from "../../../config/database";
const prisma = getDatabase();
import { trmsClient } from "../../../integrations/trms/trms.client";
import { fnWindowClient } from "../../../integrations/fn-window/fn-window.client";
import { TransactionStatus, TransactionType } from "../../../shared/types";

class RegulatoryService {
  private formATypes = [
    TransactionType.PTA,
    TransactionType.BTA,
    TransactionType.MEDICAL,
    TransactionType.SCHOOL_FEES,
    TransactionType.PROFESSIONAL_BODY,
  ];

  private currencyPair(currency: string) {
    return `${currency}/NGN`;
  }

  async complianceDashboard() {
    const [filed, kycVerified, busyQueue, rejected, highFlags, criticalFlags, watchlistActive, reviewsPending] =
      await Promise.all([
        prisma.transaction.count({ where: { formAId: { not: null }, type: { in: this.formATypes } } }),
        prisma.userKyc.count({ where: { status: "VERIFIED" } }),
        prisma.complianceReview.count({ where: { status: { in: ["PENDING", "UNDER_REVIEW"] } } }),
        prisma.transaction.count({ where: { status: "REJECTED", type: { in: this.formATypes } } }),
        prisma.amlFlag.count({ where: { severity: "HIGH" } }),
        prisma.amlFlag.count({ where: { severity: "CRITICAL" } }),
        prisma.watchList.count({ where: { isActive: true } }),
        prisma.complianceReview.count({ where: { status: "PENDING" } }),
      ]);
    const avgRisk = await prisma.amlCheck.aggregate({
      _avg: { riskScore: true },
      where: { status: { in: ["FLAGGED", "FAILED"] } },
    });
    return {
      overview: {
        filedSubmissions: filed,
        kycVerifications: kycVerified,
        busyQueue: busyQueue,
        rejectedSubmissions: rejected,
      },
      insights: {
        highSeverityFlags: highFlags,
        criticalSeverityFlags: criticalFlags,
        watchlistActive: watchlistActive,
        reviewsPending: reviewsPending,
        averageRiskScore: (avgRisk as any)._avg?.riskScore || 0,
      },
    };
  }

  async trmsStats() {
    const whereTypes = { type: { in: this.formATypes } };
    const [total, busy, approved, rejected] = await Promise.all([
      prisma.transaction.count({ where: { ...whereTypes, formAId: { not: null } } }),
      prisma.transaction.count({
        where: {
          ...whereTypes,
          formAId: { not: null },
          status: { in: [TransactionStatus.AWAITING_VERIFICATION, TransactionStatus.VERIFICATION_IN_PROGRESS, TransactionStatus.COMPLIANCE_REVIEW, TransactionStatus.ADMIN_APPROVAL_PENDING] },
        },
      }),
      prisma.transaction.count({
        where: { ...whereTypes, formAId: { not: null }, status: { in: [TransactionStatus.APPROVED, TransactionStatus.COMPLETED] } },
      }),
      prisma.transaction.count({
        where: { ...whereTypes, formAId: { not: null }, status: TransactionStatus.REJECTED },
      }),
    ]);
    return {
      totalSubmissions: total,
      busyQueue: busy,
      approvedSubmissions: approved,
      rejectedSubmissions: rejected,
    };
  }

  async trmsList(filters: { search?: string; status?: string }, page = 1, limit = 20) {
    const where: any = { type: { in: this.formATypes } };
    if (filters.status && filters.status !== "ALL") {
      if (filters.status === "BUSY") {
        where.status = { in: [TransactionStatus.AWAITING_VERIFICATION, TransactionStatus.VERIFICATION_IN_PROGRESS, TransactionStatus.COMPLIANCE_REVIEW, TransactionStatus.ADMIN_APPROVAL_PENDING] };
      } else if (filters.status === "APPROVED") {
        where.status = { in: [TransactionStatus.APPROVED, TransactionStatus.COMPLETED] };
      } else if (filters.status === "REJECTED") {
        where.status = TransactionStatus.REJECTED;
      } else {
        where.status = filters.status;
      }
    }
    if (filters.search) {
      where.OR = [
        { referenceNumber: { contains: filters.search, mode: "insensitive" } },
        { purpose: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, referenceNumber: true, userId: true, type: true, currency: true, foreignAmount: true, status: true, createdAt: true },
      }),
      prisma.transaction.count({ where }),
    ]);
    const txIds = rows.map((r: any) => r.id);
    const docCounts = txIds.length
      ? await prisma.transactionDocument.groupBy({
          by: ["transactionId"],
          where: { transactionId: { in: txIds } },
          _count: { transactionId: true },
        })
      : [];
    const countMap: Record<string, number> = {};
    docCounts.forEach((dc: any) => {
      countMap[dc.transactionId] = (dc as any)._count.transactionId;
    });
    const users = rows.length
      ? await prisma.userProfile.findMany({
          where: { userId: { in: rows.map((r: any) => r.userId) } },
          select: { userId: true, firstName: true, lastName: true },
        })
      : [];
    const nameMap: Record<string, string> = {};
    users.forEach((u: any) => {
      nameMap[u.userId] = `${u.firstName} ${u.lastName}`.trim();
    });
    const data = rows.map((r: any) => ({
      id: r.id,
      transactionId: r.referenceNumber,
      customerName: nameMap[r.userId] || r.userId,
      currencyPair: this.currencyPair(r.currency),
      type: r.type,
      amount: r.foreignAmount,
      documents: countMap[r.id] || 0,
      status: r.status,
      createdAt: r.createdAt,
    }));
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async complianceReportsList(filters: { search?: string; status?: string; fileType?: string; channel?: string }, page = 1, limit = 20) {
    const where: any = {};
    if (filters.status && filters.status !== "ALL") where.status = filters.status;
    if (filters.fileType) where.format = filters.fileType;
    if (filters.search) where.metadata = { path: "$", string_contains: filters.search } as any;
    const modules = ["TRANSACTION", "RATE", "INCIDENT"];
    where.module = { in: modules };
    const [jobs, total] = await Promise.all([
      prisma.reportJob.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, module: true, format: true, startDate: true, createdAt: true, status: true, generatedUrl: true, metadata: true },
      }),
      prisma.reportJob.count({ where }),
    ]);
    const data = jobs.map((j: any) => ({
      id: j.id,
      reportName: (j.metadata && j.metadata.reportName) || `${j.module} Report`,
      reportingDate: j.startDate,
      fileType: j.format,
      status: j.status === "COMPLETED" ? "Submitted" : j.status,
      channel: (j.metadata && j.metadata.channel) || "System",
      reference: j.id,
      url: j.generatedUrl || "",
      createdAt: j.createdAt,
    }));
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async complianceReportDetails(id: string) {
    const j = await prisma.reportJob.findUnique({
      where: { id },
      select: { id: true, module: true, format: true, startDate: true, endDate: true, createdAt: true, completedAt: true, status: true, generatedUrl: true, metadata: true },
    });
    if (!j) throw new Error("Report not found");
    return {
      reportName: (j.metadata && (j.metadata as any).reportName) || `${j.module} Report`,
      type: j.module,
      fileType: j.format,
      channel: (j.metadata && (j.metadata as any).channel) || "System",
      status: j.status === "COMPLETED" ? "Submitted" : j.status,
      reference: j.id,
      submittedOn: j.completedAt || j.createdAt,
      reportDate: j.startDate,
      endDate: j.endDate,
      fileUrl: j.generatedUrl || "",
      fileSize: (j.metadata && (j.metadata as any).fileSize) || null,
    };
  }

  async trmsDetails(transactionId: string) {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      select: {
        id: true,
        referenceNumber: true,
        userId: true,
        type: true,
        currency: true,
        foreignAmount: true,
        status: true,
        createdAt: true,
        formAId: true,
      },
    });
    if (!tx) throw new Error("Transaction not found");
    const profile = await prisma.userProfile.findFirst({
      where: { userId: tx.userId },
      select: { firstName: true, lastName: true },
    });
    const docs = await prisma.transactionDocument.findMany({
      where: { transactionId: transactionId },
      select: { id: true },
    });
    return {
      applicantName: profile ? `${profile.firstName} ${profile.lastName}`.trim() : tx.userId,
      transactionId: tx.referenceNumber,
      type: tx.type,
      currencyPair: this.currencyPair(tx.currency),
      amount: tx.foreignAmount,
      documents: docs.length,
      status: tx.status,
      formAId: tx.formAId || "",
      submittedOn: tx.formAId ? tx.createdAt : null,
    };
  }

  async trmsSubmit(transactionId: string) {
    const tx = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: { documents: true },
    });
    if (!tx) throw new Error("Transaction not found");
    const kyc = await prisma.userKyc.findFirst({
      where: { userId: tx.userId },
      select: { bvn: true, passportNumber: true },
    });
    const profile = await prisma.userProfile.findFirst({
      where: { userId: tx.userId },
      select: { firstName: true, lastName: true },
    });
    const applicantName = profile ? `${profile.firstName} ${profile.lastName}`.trim() : tx.userId;
    const payload = {
      applicantName,
      applicantBvn: kyc?.bvn || "",
      transactionType: tx.type,
      currency: tx.currency,
      amount: Number(tx.foreignAmount || 0),
      purpose: tx.purpose,
      destinationCountry: tx.destinationCountry || "",
      supportingDocuments: (tx.documents || []).map((d: any) => ({ documentType: String(d.documentType), documentUrl: d.fileUrl })),
    };
    const result = await trmsClient.submitFormA(payload);
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { formAId: result.formNumber },
    });
    return { formNumber: result.formNumber, status: result.status, submissionDate: result.submissionDate };
  }

  async trmsCheckStatus(formNumber: string) {
    const result = await trmsClient.checkFormStatus(formNumber);
    return result;
  }

  async exportSubmissions(filters: { status?: string; search?: string }, requestedBy: string) {
    const job = await prisma.reportJob.create({
      data: {
        module: "TRANSACTION",
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

  async fnWindowStats() {
    const [rates, submittedReports, pendingReports] = await Promise.all([
      fnWindowClient.getCurrentRates(),
      prisma.reportJob.count({ where: { module: "RATE", status: "COMPLETED" } }),
      prisma.reportJob.count({ where: { module: "RATE", status: "PENDING" } }),
    ]);
    return {
      dailyFxSalesAllocations: rates.length,
      fnWindowDailyReports: submittedReports,
      activeComplianceReports: pendingReports,
    };
  }

  async fnWindowRates() {
    const rates = await fnWindowClient.getCurrentRates();
    return rates;
  }

  async fnWindowRate(base: string, quote: string) {
    const res = await fnWindowClient.getCurrencyRate(base, quote);
    return res;
  }

  async cbnFnReportsList(filters: { search?: string; status?: string; reportType?: string }, page = 1, limit = 20) {
    const where: any = { module: "RATE" };
    if (filters.status && filters.status !== "ALL") where.status = filters.status;
    if (filters.search) where.metadata = { path: "$", string_contains: filters.search } as any;
    const [jobs, total] = await Promise.all([
      prisma.reportJob.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, module: true, format: true, startDate: true, createdAt: true, status: true, generatedUrl: true, metadata: true },
      }),
      prisma.reportJob.count({ where }),
    ]);
    const data = jobs.map((j: any) => ({
      id: j.id,
      reportName: (j.metadata && j.metadata.reportName) || "Daily FX sales report",
      reportType: (j.metadata && j.metadata.reportType) || "Daily",
      status: j.status === "COMPLETED" ? "Submitted" : j.status,
      channel: "FN window",
      reference: j.id,
      createdAt: j.createdAt,
      fileType: j.format,
    }));
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async cbnFnReportDetails(id: string) {
    const j = await prisma.reportJob.findUnique({
      where: { id },
      select: { id: true, module: true, format: true, startDate: true, endDate: true, createdAt: true, completedAt: true, status: true, generatedUrl: true, metadata: true },
    });
    if (!j) throw new Error("Report not found");
    return {
      reportName: (j.metadata && (j.metadata as any).reportName) || "Daily FX sales report",
      type: (j.metadata && (j.metadata as any).reportType) || "Daily",
      fileType: j.format,
      channel: "FN window",
      status: j.status === "COMPLETED" ? "Submitted" : j.status,
      reference: j.id,
      lastAction: j.status,
      submissionTime: j.completedAt || null,
      cbnCode: (j.metadata && (j.metadata as any).cbnCode) || null,
      errorCode: (j.metadata && (j.metadata as any).errorCode) || null,
      fileSize: (j.metadata && (j.metadata as any).fileSize) || null,
      fileUrl: j.generatedUrl || "",
    };
  }

  async auditLogsList(filters: { search?: string; severity?: string; category?: string }, page = 1, limit = 20) {
    const where: any = {};
    if (filters.severity && filters.severity !== "ALL") where.severity = filters.severity;
    if (filters.category && filters.category !== "ALL") where.category = filters.category;
    if (filters.search) {
      where.OR = [
        { eventType: { contains: filters.search, mode: "insensitive" } },
        { action: { contains: filters.search, mode: "insensitive" } },
        { source: { contains: filters.search, mode: "insensitive" } },
      ];
    }
    const [events, total] = await Promise.all([
      prisma.auditEvent.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { timestamp: "desc" },
        select: { id: true, eventId: true, eventType: true, category: true, severity: true, source: true, userId: true, action: true, timestamp: true },
      }),
      prisma.auditEvent.count({ where }),
    ]);
    const users = events.length
      ? await prisma.adminUser.findMany({
          where: { id: { in: events.map((e: any) => e.userId).filter(Boolean) } },
          select: { id: true, fullName: true },
        })
      : [];
    const nameMap: Record<string, string> = {};
    users.forEach((u: any) => (nameMap[u.id] = u.fullName));
    const actionResult = (sev: string) => (sev === "ERROR" || sev === "CRITICAL" ? "Failed" : sev === "WARNING" ? "Warning" : "Submitted");
    const data = events.map((e: any) => ({
      id: e.id,
      timestamp: e.timestamp,
      userOrSystem: e.userId ? (nameMap[e.userId] || e.userId) : "System",
      actionPerformed: e.action || e.eventType,
      actionResult: actionResult(e.severity),
      channel: e.source,
      auditId: e.eventId || e.id,
    }));
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async auditLogDetails(id: string) {
    let e = await prisma.auditEvent.findUnique({
      where: { id },
      select: { id: true, eventId: true, eventType: true, category: true, severity: true, source: true, userId: true, action: true, metadata: true, timestamp: true },
    });
    if (!e) {
      e = await prisma.auditEvent.findUnique({ where: { eventId: id } as any });
    }
    if (!e) throw new Error("Audit event not found");
    const user = e.userId ? await prisma.adminUser.findUnique({ where: { id: e.userId }, select: { fullName: true } }) : null;
    return {
      timestamp: (e as any).timestamp,
      source: (e as any).source,
      description: (e as any).action || (e as any).eventType,
      duplicate: false,
      response: (e as any).metadata && (e as any).metadata.response,
      result: (e as any).severity,
      auditId: (e as any).eventId || (e as any).id,
      user: user?.fullName || (e as any).userId || "System",
    };
  }

  async regulatoryLogsList(filters: { search?: string; status?: string }, page = 1, limit = 20) {
    const whereJob: any = {};
    if (filters.status && filters.status !== "ALL") whereJob.status = filters.status;
    if (filters.search) whereJob.metadata = { path: "$", string_contains: filters.search } as any;
    const [jobs, jobsTotal] = await Promise.all([
      prisma.reportJob.findMany({
        where: whereJob,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, module: true, status: true, createdAt: true },
      }),
      prisma.reportJob.count({ where: whereJob }),
    ]);
    const nfWhere: any = {};
    const [nfiu, nfTotal] = await Promise.all([
      prisma.nfiuReport.findMany({
        where: nfWhere,
        skip: 0,
        take: 0,
        orderBy: { reportedAt: "desc" },
        select: { id: true, reportType: true, reportedAt: true, reportReference: true },
      }),
      prisma.nfiuReport.count({ where: nfWhere }),
    ]);
    const entries = [
      ...jobs.map((j: any) => ({
        id: j.id,
        timestamp: j.createdAt,
        userOrSystem: "System",
        actionPerformed: `${j.module} export`,
        actionResult: j.status === "COMPLETED" ? "Submitted" : j.status,
        channel: j.module === "RATE" ? "FN window" : "System",
        regulatoryId: j.id,
      })),
      ...nfiu.map((n: any) => ({
        id: n.id,
        timestamp: n.reportedAt,
        userOrSystem: "Compliance Officer",
        actionPerformed: `${n.reportType} report`,
        actionResult: "Submitted",
        channel: "TRMS/NFIU",
        regulatoryId: n.reportReference,
      })),
    ];
    const total = jobsTotal + nfTotal;
    const paged = entries.slice((page - 1) * limit, (page - 1) * limit + limit);
    return { data: paged, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async regulatoryLogDetails(id: string) {
    const j = await prisma.reportJob.findUnique({
      where: { id },
      select: { id: true, module: true, status: true, createdAt: true, completedAt: true, generatedUrl: true, metadata: true },
    });
    if (j) {
      return {
        timestamp: j.createdAt,
        source: "System",
        description: (j.metadata && (j.metadata as any).reportName) || `${j.module} export`,
        duplicate: false,
        response: j.status,
        result: j.status === "COMPLETED" ? "Submitted" : j.status,
        regulatoryId: j.id,
        channel: j.module === "RATE" ? "FN window" : "System",
        fileUrl: j.generatedUrl || "",
      };
    }
    const n = await prisma.nfiuReport.findUnique({
      where: { id },
      select: { id: true, reportType: true, reportedAt: true, reportReference: true, reportData: true },
    });
    if (!n) throw new Error("Regulatory log not found");
    return {
      timestamp: n.reportedAt,
      source: "Compliance",
      description: `${n.reportType} submitted`,
      duplicate: false,
      response: "200 OK",
      result: "Submitted",
      regulatoryId: n.reportReference,
      channel: "TRMS/NFIU",
      fileUrl: "",
    };
  }
}

export const regulatoryService = new RegulatoryService();
