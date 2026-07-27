import { getDatabase } from "../../../config/database";
const prisma = getDatabase();
import { trmsClient } from "../../../integrations/trms/trms.client";
import { fnWindowClient } from "../../../integrations/fn-window/fn-window.client";
import { DocumentType, TransactionStatus, TransactionType } from "@prisma/client";

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
    const now = new Date();
    const oneDayMs = 24 * 60 * 60 * 1000;
    const slaMs = oneDayMs; // 24h SLA for review completion
    const weekAgo = new Date(now.getTime() - 7 * oneDayMs);
    const prevWeekStart = new Date(now.getTime() - 14 * oneDayMs);
    const prevWeekEnd = new Date(now.getTime() - 7 * oneDayMs);

    const reportModules = ["TRANSACTION", "RATE", "INCIDENT"];

    // Summary cards
    const [submittedReports, pendingSubmissions, failedSubmissions, rejectedReports] = await Promise.all([
      prisma.reportJob.count({ where: { module: { in: reportModules as any }, status: { in: ["COMPLETED", "SUCCESS", "SUBMITTED"] } } }),
      prisma.reportJob.count({ where: { module: { in: reportModules as any }, status: { in: ["PENDING", "IN_PROGRESS"] } } }),
      prisma.reportJob.count({ where: { module: { in: reportModules as any }, status: { in: ["FAILED", "ERROR"] } } }),
      prisma.reportJob.count({ where: { module: { in: reportModules as any }, status: "REJECTED" } }),
    ]);

    // SLA tracker
    // Fetch reviews by creation-week cohorts so that numerator and denominator
    // always refer to the same set of records (reviews *created* in the window).
    // On-time = completed within slaMs (24 h) of creation.

    const [
      reviewsPendingOld,
      thisWeekCohort,
      prevWeekCohort,
      allReviewedSample,
    ] = await Promise.all([
      // Missed: still open and already past the SLA deadline
      prisma.complianceReview.count({
        where: {
          status: { in: ["PENDING", "UNDER_REVIEW"] },
          createdAt: { lt: new Date(now.getTime() - slaMs) },
        },
      }),
      // This-week cohort: all reviews created in the last 7 days
      prisma.complianceReview.findMany({
        where: { createdAt: { gte: weekAgo, lte: now } },
        select: { createdAt: true, reviewedAt: true },
      }),
      // Prev-week cohort: all reviews created in the 7 days before that
      prisma.complianceReview.findMany({
        where: { createdAt: { gte: prevWeekStart, lt: prevWeekEnd } },
        select: { createdAt: true, reviewedAt: true },
      }),
      // All-time sample for overall compliance rate & avg resolution time
      prisma.complianceReview.findMany({
        where: { reviewedAt: { not: null } },
        select: { createdAt: true, reviewedAt: true },
        take: 5000,
        orderBy: { reviewedAt: "desc" },
      }),
    ]);

    // Compute this-week SLA rate from the cohort (same set for numerator & denominator)
    let onTimeThisWeek = 0;
    const totalThisWeek = thisWeekCohort.length;
    thisWeekCohort.forEach((r: { createdAt: Date; reviewedAt: Date | null }) => {
      if (r.reviewedAt) {
        const diff = new Date(r.reviewedAt).getTime() - new Date(r.createdAt).getTime();
        if (diff <= slaMs) onTimeThisWeek += 1;
      }
    });

    // Compute prev-week SLA rate from its cohort
    let onTimePrevWeek = 0;
    const totalPrevWeek = prevWeekCohort.length;
    prevWeekCohort.forEach((r: { createdAt: Date; reviewedAt: Date | null }) => {
      if (r.reviewedAt) {
        const diff = new Date(r.reviewedAt).getTime() - new Date(r.createdAt).getTime();
        if (diff <= slaMs) onTimePrevWeek += 1;
      }
    });

    // Compute overall on-time/late and avg resolution from the all-time sample
    let onTimeSubmissions = 0;
    let lateSubmissions = 0;
    let totalResolutionTimeMs = 0;
    allReviewedSample.forEach((r: { createdAt: Date; reviewedAt: Date | null }) => {
      const diff = new Date(r.reviewedAt!).getTime() - new Date(r.createdAt).getTime();
      totalResolutionTimeMs += diff;
      if (diff <= slaMs) onTimeSubmissions += 1;
      else lateSubmissions += 1;
    });
    const avgResolutionHours =
      allReviewedSample.length > 0
        ? Math.round(((totalResolutionTimeMs / allReviewedSample.length) / (1000 * 60 * 60)) * 10) / 10
        : 0;

    const missed = reviewsPendingOld;
    const denom = onTimeSubmissions + lateSubmissions + missed || 1;
    const slaComplianceRate = Math.round(((onTimeSubmissions / denom) * 100) * 10) / 10;
    const rateThisWeek = totalThisWeek ? onTimeThisWeek / totalThisWeek : 0;
    const ratePrevWeek = totalPrevWeek ? onTimePrevWeek / totalPrevWeek : 0;
    const trendDeltaPercent = Math.round(((rateThisWeek - ratePrevWeek) * 100) * 10) / 10;

    // Sanctions screening outcomes (AML checks)
    const [amlPassed, amlFlagged, amlFailed, amlPending, amlInProgress, amlTotal] = await Promise.all([
      prisma.amlCheck.count({ where: { status: "PASSED" } }),
      prisma.amlCheck.count({ where: { status: "FLAGGED" } }),
      prisma.amlCheck.count({ where: { status: "FAILED" } }),
      prisma.amlCheck.count({ where: { status: "PENDING" } }),
      prisma.amlCheck.count({ where: { status: "IN_PROGRESS" } }),
      prisma.amlCheck.count({}),
    ]);

    // Cumulative FX sold by type (approved/completed transactions)
    const approvedStatuses = [TransactionStatus.APPROVED, TransactionStatus.COMPLETED];
    const sumByType = async (type: TransactionType) => {
      const agg = await prisma.transaction.aggregate({
        where: { type, status: { in: approvedStatuses } },
        _sum: { foreignAmount: true },
      });
      return Number((agg as any)?._sum?.foreignAmount || 0);
    };
    const [pta, bta, school, medical, imports] = await Promise.all([
      sumByType(TransactionType.PTA),
      sumByType(TransactionType.BTA),
      sumByType(TransactionType.SCHOOL_FEES),
      sumByType(TransactionType.MEDICAL),
      // Map 'Imports' to PROFESSIONAL_BODY until specific IMPORT type exists
      sumByType(TransactionType.PROFESSIONAL_BODY),
    ]);
    const fxTotal = pta + bta + school + medical + imports;

    return {
      overview: {
        submittedReports,
        pendingSubmissions,
        failedSubmissions,
        rejectedReports,
      },
      insights: {
        sla: {
          complianceRate: slaComplianceRate, // percentage
          onTime: onTimeSubmissions,
          late: lateSubmissions,
          missed,
          trend: { delta: trendDeltaPercent }, // percentage difference vs last week
          target: 90,
          averageResolutionTimeHours: avgResolutionHours,
        },
        screening: {
          passed: amlPassed,
          flagged: amlFlagged,
          rejected: amlFailed,
          pendingReview: amlPending + amlInProgress,
          totalScreened: amlTotal,
        },
        fxSold: {
          PTA: pta,
          BTA: bta,
          School: school,
          Medical: medical,
          Imports: imports,
          total: fxTotal,
        },
      },
    };
  }

  async trmsStats() {
    const whereTypes = { type: { in: this.formATypes } };
    const busyStatuses = [
      TransactionStatus.AWAITING_VERIFICATION,
      TransactionStatus.VERIFICATION_IN_PROGRESS,
      TransactionStatus.COMPLIANCE_REVIEW,
      TransactionStatus.ADMIN_APPROVAL_PENDING,
    ];
    const [total, busy, approved, rejected, failed] = await Promise.all([
      prisma.transaction.count({ where: { ...whereTypes } }),
      prisma.transaction.count({
        where: {
          ...whereTypes,
          status: { in: busyStatuses },
        },
      }),
      prisma.transaction.count({
        where: { ...whereTypes, status: { in: [TransactionStatus.APPROVED, TransactionStatus.COMPLETED] } },
      }),
      prisma.transaction.count({
        where: { ...whereTypes, status: TransactionStatus.REJECTED },
      }),
      prisma.transaction.count({
        where: { ...whereTypes, status: TransactionStatus.CANCELLED },
      }),
    ]);

    return {
      submittedReports: total,
      pendingSubmissions: busy,
      failedSubmissions: failed,
      rejectedReports: rejected
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
      } else if (filters.status === "FAILED") {
        where.status = TransactionStatus.CANCELLED;
      } else {
        where.status = filters.status.toUpperCase();
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
    if (filters.status && filters.status !== "ALL") where.status = filters.status.toUpperCase();
    if (filters.fileType) where.format = filters.fileType.toUpperCase();
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      const searchUpper = filters.search.toUpperCase();
      const searchCapitalized = filters.search.charAt(0).toUpperCase() + filters.search.slice(1).toLowerCase();

      where.OR = [
        { metadata: { path: ["reportName"], string_contains: filters.search } as any },
        { metadata: { path: ["reportName"], string_contains: searchLower } as any },
        { metadata: { path: ["reportName"], string_contains: searchUpper } as any },
        { metadata: { path: ["reportName"], string_contains: searchCapitalized } as any },
        { metadata: { path: ["channel"], string_contains: filters.search } as any },
        { metadata: { path: ["channel"], string_contains: searchLower } as any },
        { metadata: { path: ["channel"], string_contains: searchUpper } as any },
        { metadata: { path: ["channel"], string_contains: searchCapitalized } as any },
      ];
    }
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
      status: (j.status === "COMPLETED" || j.status === "SUCCESS" || j.status === "SUBMITTED") ? "Submitted" : j.status,
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
      status: (j.status === "COMPLETED" || j.status === "SUCCESS" || j.status === "SUBMITTED") ? "Submitted" : j.status,
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
    const [profile, docs, formADocument] = await Promise.all([
      prisma.userProfile.findFirst({
        where: { userId: tx.userId },
        select: { firstName: true, lastName: true },
      }),
      prisma.transactionDocument.findMany({
        where: { transactionId: transactionId },
        select: { id: true },
      }),
      prisma.transactionDocument.findFirst({
        where: { transactionId: transactionId, documentType: DocumentType.FORM_A_DOCUMENT as any },
        select: { fileUrl: true },
      }),
    ]);
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
      fileUrl: (formADocument as any)?.fileUrl || "",
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
    // Dummy response for CBN/TRMS interaction
    const dummyResult = {
      formNumber: `FORMA-${Math.floor(100000 + Math.random() * 900000)}`,
      status: "SUBMITTED",
      submissionDate: new Date().toISOString(),
    };

    await prisma.transaction.update({
      where: { id: transactionId },
      data: { formAId: dummyResult.formNumber },
    });

    return dummyResult;
  }

  async trmsCheckStatus(formNumber: string) {
    // Dummy response for CBN/TRMS status check
    return {
      formNumber,
      status: "APPROVED",
      submissionDate: new Date(Date.now() - 86400000).toISOString(),
      history: [
        { status: "SUBMITTED", date: new Date(Date.now() - 86400000).toISOString() },
        { status: "UNDER_REVIEW", date: new Date(Date.now() - 43200000).toISOString() },
        { status: "APPROVED", date: new Date().toISOString() },
      ],
    };
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
    const [submittedReports, pendingReports] = await Promise.all([
      prisma.reportJob.count({ where: { module: "RATE", status: { in: ["COMPLETED", "SUCCESS", "SUBMITTED"] } } }),
      prisma.reportJob.count({ where: { module: "RATE", status: { in: ["PENDING", "IN_PROGRESS"] } } }),
    ]);
    // Dummy response for CBN/FN Window rates count
    const ratesCount = 3;
    return {
      dailyFxSalesAllocations: ratesCount,
      fnWindowDailyReports: submittedReports,
      activeComplianceReports: pendingReports,
    };
  }

  async fnWindowRates() {
    // Dummy response for CBN/FN Window rates
    return [
      { base: "USD", quote: "NGN", rate: 1550.00, bidVolume: 1000000, offerVolume: 800000, updatedAt: new Date().toISOString() },
      { base: "GBP", quote: "NGN", rate: 1950.00, bidVolume: 500000, offerVolume: 400000, updatedAt: new Date().toISOString() },
      { base: "EUR", quote: "NGN", rate: 1650.00, bidVolume: 300000, offerVolume: 250000, updatedAt: new Date().toISOString() },
    ];
  }

  async fnWindowRate(base: string, quote: string) {
    // Dummy response for CBN/FN Window rate detail
    return {
      base: base || "USD",
      quote: quote || "NGN",
      rate: 1550.00,
      bidVolume: 1000000,
      offerVolume: 800000,
      updatedAt: new Date().toISOString()
    };
  }

  async cbnFnReportsList(filters: { search?: string; status?: string; reportType?: string }, page = 1, limit = 20) {
    const where: any = { module: "RATE" };
    if (filters.status && filters.status !== "ALL") where.status = filters.status.toUpperCase();
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      where.OR = [
        { id: { contains: filters.search, mode: "insensitive" } },
        { status: { contains: filters.search, mode: "insensitive" } },
      ];
      if (searchLower === "csv" || searchLower === "pdf") {
        where.OR.push({ format: searchLower.toUpperCase() as any });
      }
      if ("submitted".includes(searchLower)) {
        where.OR.push({ status: "COMPLETED" });
      }
    }
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
      status: (j.status === "COMPLETED" || j.status === "SUCCESS" || j.status === "SUBMITTED") ? "Submitted" : j.status,
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
      status: (j.status === "COMPLETED" || j.status === "SUCCESS" || j.status === "SUBMITTED") ? "Submitted" : j.status,
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
    if (filters.severity && filters.severity !== "ALL") where.severity = filters.severity.toUpperCase();
    if (filters.category && filters.category !== "ALL") where.category = filters.category.toUpperCase();
    if (filters.search) {
      // Find matching admin users by full name
      const matchedUsers = await prisma.adminUser.findMany({
        where: {
          fullName: { contains: filters.search, mode: "insensitive" },
        },
        select: { id: true },
      });
      const userIds = matchedUsers.map((u: any) => u.id);

      where.OR = [
        { eventType: { contains: filters.search, mode: "insensitive" } },
        { action: { contains: filters.search, mode: "insensitive" } },
        { source: { contains: filters.search, mode: "insensitive" } },
        { userId: { contains: filters.search, mode: "insensitive" } },
      ];

      if (userIds.length > 0) {
        where.OR.push({ userId: { in: userIds } });
      }
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
    const data = events.map((e: any) => {
      let moduleSection = "System";
      if (e.category === "COMPLIANCE") moduleSection = "Compliance";
      else if (e.category === "TRANSACTION") moduleSection = "Transaction Management";
      else if (e.category === "PAYMENT") moduleSection = "Payment Processing";
      else if (e.category === "AUTHENTICATION") moduleSection = "Authentication";
      else if (e.category === "ADMIN") moduleSection = "Admin Operations";
      
      if (e.eventType?.includes("rate")) moduleSection = "Rate Management";
      if (e.eventType?.includes("report")) moduleSection = "FX Report";

      return {
        id: e.id,
        timestamp: e.timestamp,
        userOrSystem: e.userId ? (nameMap[e.userId] || e.userId) : "System",
        actionPerformed: e.action || e.eventType,
        actionResult: actionResult(e.severity),
        moduleSection,
        auditId: e.eventId || e.id,
      };
    });
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
    if (filters.status && filters.status !== "ALL") whereJob.status = filters.status.toUpperCase();
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      
      // If searching for "system" or "sys" or "export", it matches all report jobs
      if (searchLower.includes("sys") || searchLower.includes("system") || searchLower.includes("export")) {
        // Match all ReportJobs under this search term
      } else {
        const orConditions: any[] = [
          { id: { contains: filters.search, mode: "insensitive" } },
          { status: { contains: filters.search, mode: "insensitive" } },
        ];

        const modules = ["OUTLET", "RATE", "TRANSACTION", "WORKFLOW", "AGENT", "FRANCHISE", "BRANCH", "INCIDENT"];
        const matchingModules = modules.filter(m => m.toLowerCase().includes(searchLower));
        if (matchingModules.length > 0) {
          orConditions.push({ module: { in: matchingModules as any } });
        }

        if ("submitted".includes(searchLower)) {
          orConditions.push({ status: "COMPLETED" });
        }

        if ("rate management".includes(searchLower)) {
          orConditions.push({ module: "RATE" });
        }
        if ("fx report".includes(searchLower)) {
          orConditions.push({ module: "TRANSACTION" });
        }
        if ("cbn report".includes(searchLower)) {
          const cbnModules = ["OUTLET", "WORKFLOW", "AGENT", "FRANCHISE", "BRANCH", "INCIDENT"];
          orConditions.push({ module: { in: cbnModules as any } });
        }

        whereJob.OR = orConditions;
      }
    }
    const shouldQueryNfiu = !filters.status || filters.status === "ALL" || filters.status.toUpperCase() === "COMPLETED";

    const [jobs, jobsTotal] = await Promise.all([
      prisma.reportJob.findMany({
        where: whereJob,
        take: page * limit,
        orderBy: { createdAt: "desc" },
        select: { id: true, module: true, status: true, createdAt: true, generatedUrl: true },
      }),
      prisma.reportJob.count({ where: whereJob }),
    ]);
    const nfWhere: any = {};
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      if (searchLower.includes("compliance") || searchLower.includes("officer") || "submitted".includes(searchLower)) {
        // Match all NFIU reports
      } else {
        const nfOr: any[] = [
          { id: { contains: filters.search, mode: "insensitive" } },
          { reportReference: { contains: filters.search, mode: "insensitive" } },
          { reportType: { contains: filters.search, mode: "insensitive" } },
          { reason: { contains: filters.search, mode: "insensitive" } },
        ];

        if ("cbn report".includes(searchLower)) {
          nfOr.push({ reportType: "CBN" });
        }
        if ("fx report".includes(searchLower)) {
          nfOr.push({ reportType: "FX" });
        }
        if ("nfiu report".includes(searchLower)) {
          nfOr.push({ reportType: "NFIU" });
        }

        nfWhere.OR = nfOr;
      }
    }
    const [nfiu, nfTotal] = shouldQueryNfiu
      ? await Promise.all([
          prisma.nfiuReport.findMany({
            where: nfWhere,
            take: page * limit,
            orderBy: { reportedAt: "desc" },
            select: { id: true, reportType: true, reportedAt: true, reportReference: true },
          }),
          prisma.nfiuReport.count({ where: nfWhere }),
        ])
      : [[], 0];
    const entries = [
      ...jobs.map((j: any) => ({
        id: j.id,
        timestamp: j.createdAt,
        userOrSystem: "System",
        actionPerformed: `${j.module} export`,
        actionResult: (j.status === "COMPLETED" || j.status === "SUCCESS" || j.status === "SUBMITTED") ? "Submitted" : j.status,
        moduleSection: j.module === "RATE" ? "Rate Management" : j.module === "TRANSACTION" ? "FX Report" : "CBN Report",
        regulatoryId: j.id,
      })),
      ...nfiu.map((n: any) => ({
        id: n.id,
        timestamp: n.reportedAt,
        userOrSystem: "Compliance Officer",
        actionPerformed: `${n.reportType} report`,
        actionResult: "Submitted",
        moduleSection: n.reportType === "CBN" ? "CBN Report" : n.reportType === "FX" ? "FX Report" : n.reportType === "NFIU Report",
        regulatoryId: n.reportReference,
      })),
    ];
    // Sort combined entries chronologically (newest first)
    entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    const total = jobsTotal + nfTotal;
    const paged = entries.slice((page - 1) * limit, page * limit);
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
        result: (j.status === "COMPLETED" || j.status === "SUCCESS" || j.status === "SUBMITTED") ? "Submitted" : j.status,
        regulatoryId: j.id,
        moduleSection: j.module === "RATE" ? "Rate Management" : j.module === "TRANSACTION" ? "FX Report" : "CBN Report",
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
      moduleSection: n.reportType === "CBN" ? "CBN Report" : n.reportType === "FX" ? "FX Report" : "NFIU Report",
      fileUrl: "",
    };
  }
}

export const regulatoryService = new RegulatoryService();
