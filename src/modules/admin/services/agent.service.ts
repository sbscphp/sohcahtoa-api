import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { ValidationError, NotFoundError } from "../../../shared/utils/errors";
import authService from "../../auth/services/auth.service";
import { OtpPurpose } from "../../../shared/types";
import customerTransactionService from "../../customer/services/customer-transaction.service";

const prisma: PrismaClient = getDatabase();

class AgentService {
  async stats() {
    const client: any = prisma as any;
    const [total, active, deactivated] = await Promise.all([
      client.agent.count(),
      client.agent.count({ where: { isActive: true } }),
      client.agent.count({ where: { isActive: false } }),
    ]);
    return { total, active, deactivated, pendingApproval: 0 };
  }

  private async getAgentWhereClause(filters: any = {}) {
    const where: any = {};
    const search = (((filters || {}).search ?? (filters || {}).q) || "").toString().trim();
    
    // Status / Active filter
    const statusRaw = (filters.status ?? filters.isActive ?? "").toString().trim().toLowerCase();
    if (statusRaw === "active") {
      where.isActive = true;
    } else if (statusRaw === "deactivated") {
      where.isActive = false;
    } else if (statusRaw === "pending") {
      where.isActive = true; // Fallback so we don't break existing queries entirely, but technically pending doesn't exist.
    } else if (statusRaw === "true") {
      where.isActive = true;
    } else if (statusRaw === "false") {
      where.isActive = false;
    }

    // Approval filter
    if (filters.isApproved !== undefined && filters.isApproved !== "") {
      where.isApproved = String(filters.isApproved) === "true";
    }

    // Branch filter
    const branchRaw = ((filters || {}).branch ?? (filters || {}).branchId ?? "").toString().trim();
    if (branchRaw) {
      const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchRaw);
      if (isUuid) {
        where.branchId = branchRaw;
      } else {
        const branch = await (prisma as any).branch.findFirst({
          where: { name: { equals: branchRaw, mode: "insensitive" } },
          select: { id: true },
        });
        if (branch) {
          where.branchId = branch.id;
        } else {
          // If branch not found by name, we ensure zero results are returned instead of throwing
          // or we can throw if that's the preferred behavior. Given this is a filter, zero results is safer.
          where.branchId = "non-existent-id"; 
        }
      }
    }

    // Date range filter
    const fromDateRaw = (filters.fromDate || filters.dateFrom || "").toString().trim();
    const toDateRaw = (filters.toDate || filters.dateTo || "").toString().trim();
    if (fromDateRaw || toDateRaw) {
      const createdRange: any = {};
      if (fromDateRaw) {
        const d = new Date(fromDateRaw);
        if (!isNaN(d.getTime())) createdRange.gte = d;
      }
      if (toDateRaw) {
        const d = new Date(toDateRaw);
        if (!isNaN(d.getTime())) createdRange.lte = d;
      }
      if (Object.keys(createdRange).length > 0) {
        where.createdAt = createdRange;
      }
    }

    // Search filter
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    return where;
  }

  async listAll(filters: any = {}) {
    const where = await this.getAgentWhereClause(filters);

    const items = await (prisma as any).agent.findMany({
      where,
      orderBy: { name: "asc" },
      take: 10_000,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        isApproved: true,
        branchId: true,
        branch: { select: { id: true, name: true } },
      },
    });

    return (items || []).map((a: any) => ({
      id: a.id,
      name: a.name,
      email: a.email,
      phoneNumber: a.phoneNumber,
      isActive: a.isActive,
      isApproved: a.isApproved,
      branchId: a.branchId || null,
      branchName: a.branch?.name || null,
    }));
  }

  async list(filters: any = {}, page = 1, limit = 20) {
    const where = await this.getAgentWhereClause(filters);
    const skip = (page - 1) * limit;
    const sortOrder = ((filters.sort || "").toString().toLowerCase() === "asc" ? "asc" : "desc") as "asc" | "desc";
    const [total, items] = await Promise.all([
      (prisma as any).agent.count({ where }),
      (prisma as any).agent.findMany({
        where,
        orderBy: { createdAt: sortOrder },
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          phoneNumber: true,
          isActive: true,
          isApproved: true,
          createdAt: true,
          branch: { select: { id: true, name: true } },
        },
      }),
    ]);

    const agentIds = (items || []).map((a: any) => a.id).filter(Boolean);
    const volumesByAgentId = new Map<string, { count: number; volume: number }>();
    if (agentIds.length) {
      const transactions = await (prisma as any).transaction.findMany({
        where: { createdByAgentId: { in: agentIds } },
        select: {
          createdByAgentId: true,
          nairaEquivalent: true,
          foreignAmount: true,
          cashPickup: { select: { amount: true } },
        },
      });

      for (const t of transactions || []) {
        const agentId = t.createdByAgentId;
        if (!agentId) continue;
        const prev = volumesByAgentId.get(agentId) || { count: 0, volume: 0 };
        const value = Number(t.nairaEquivalent || t.foreignAmount || t.cashPickup?.amount || 0);
        volumesByAgentId.set(agentId, { count: prev.count + 1, volume: prev.volume + value });
      }
    }

    const enriched = (items || []).map((a: any) => {
      const totals = volumesByAgentId.get(a.id) || { count: 0, volume: 0 };
      const branchName = a.branch?.name || null;
      const { branch: _branch, ...agentWithoutBranchObj } = a;
      return {
        ...agentWithoutBranchObj,
        branchName,
        status: a.isActive ? "Active" : "Deactivated",
        totalTransactions: totals.count,
        totalTransactionsVolume: totals.volume,
      };
    });

    return { data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  
  async export(filters: any = {}) {
    const where = await this.getAgentWhereClause(filters);
    const sortOrder = ((filters.sort || "").toString().toLowerCase() === "asc" ? "asc" : "desc") as "asc" | "desc";
    const client: any = prisma as any;
    const agents = await client.agent.findMany({
      where,
      orderBy: { createdAt: sortOrder },
      take: 10_000,
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        branchId: true,
        branch: { select: { name: true } },
      },
    });
    const results = await Promise.all(
      (agents || []).map(async (a: any) => {
        const [count, sumNairaAgg, sumForeignAgg, sumPickupAgg] = await Promise.all([
          client.transaction.count({ where: { createdByAgentId: a.id } }),
          client.transaction.aggregate({
            where: { createdByAgentId: a.id, nairaEquivalent: { not: null } },
            _sum: { nairaEquivalent: true },
          }),
          client.transaction.aggregate({
            where: { createdByAgentId: a.id, nairaEquivalent: null, foreignAmount: { not: null } },
            _sum: { foreignAmount: true },
          }),
          client.cashPickup.aggregate({
            where: { transaction: { createdByAgentId: a.id, nairaEquivalent: null, foreignAmount: null } },
            _sum: { amount: true },
          }),
        ]);
        const volNaira = Number((sumNairaAgg as any)?._sum?.nairaEquivalent || 0);
        const volForeign = Number((sumForeignAgg as any)?._sum?.foreignAmount || 0);
        const volPickup = Number((sumPickupAgg as any)?._sum?.amount || 0);
        const vol = volNaira + volForeign + volPickup;
        return {
          agentName: a.name,
          agentId: a.id,
          branchName: a.branch?.name || null,
          contactPhone: a.phoneNumber,
          contactEmail: a.email,
          totalTransactions: count,
          transactionVolume: vol,
          status: a.isActive ? "Active" : "Deactivated",
        };
      })
    );
    return results;
  }

  async get(id: string) {
    const client: any = prisma as any;
    const agent = await client.agent.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        isApproved: true,
        createdAt: true,
        updatedAt: true,
        branchId: true,
        branch: {
          select: {
            id: true,
            name: true,
            state: true,
            address: true,
            email: true,
            phoneNumber: true,
            branchManager: true,
          },
        },
        attachments: {
          select: {
            id: true,
            fileUrl: true,
            fileName: true,
            fileSize: true,
            mimeType: true,
            createdAt: true,
          },
        },
      },
    });
    if (!agent) return null;
    const [totalTransactions, sumNairaAgg, sumForeignAgg, sumPickupAgg] = await Promise.all([
      client.transaction.count({ where: { createdByAgentId: id } }),
      client.transaction.aggregate({
        where: { createdByAgentId: id, nairaEquivalent: { not: null } },
        _sum: { nairaEquivalent: true },
      }),
      client.transaction.aggregate({
        where: { createdByAgentId: id, nairaEquivalent: null, foreignAmount: { not: null } },
        _sum: { foreignAmount: true },
      }),
      client.cashPickup.aggregate({
        where: { transaction: { createdByAgentId: id, nairaEquivalent: null, foreignAmount: null } },
        _sum: { amount: true },
      }),
    ]);
    const volNaira = Number((sumNairaAgg as any)?._sum?.nairaEquivalent || 0);
    const volForeign = Number((sumForeignAgg as any)?._sum?.foreignAmount || 0);
    const volPickup = Number((sumPickupAgg as any)?._sum?.amount || 0);
    const totalTransactionsVolume = volNaira + volForeign + volPickup;
    const { branchId: _omit, ...rest } = agent as any;
    const status = agent.isActive ? "Active" : "Deactivated";
    return { ...rest, status, totalTransactions, totalTransactionsVolume };
  }

  async update(id: string, data: { name?: string; email?: string; phoneNumber?: string; branch?: string; attachment?: { fileUrl: string; fileName?: string; fileSize?: number; mimeType?: string } }) {
    if (!data || (!data.name && !data.email && !data.phoneNumber && !data.branch)) {
      throw new ValidationError("No update fields provided");
    }
    const client: any = prisma as any;
    const existing = await client.agent.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundError("Agent not found");
    }
    if (data.email) {
      const existingEmail = await client.agent.findFirst({
        where: { email: data.email, NOT: { id } },
        select: { id: true },
      });
      if (existingEmail) {
        throw new ValidationError("Agent with this email already exists", { field: "email" });
      }
    }
    if (data.phoneNumber) {
      const existingPhone = await client.agent.findFirst({
        where: { phoneNumber: data.phoneNumber, NOT: { id } },
        select: { id: true },
      });
      if (existingPhone) {
        throw new ValidationError("Agent with this phone number already exists", { field: "phoneNumber" });
      }
    }
    let branchIdUpdate: any = {};
    if (data.branch) {
      const foundBranch = await client.branch.findFirst({
        where: { name: { equals: data.branch, mode: "insensitive" } },
        select: { id: true },
      });
      if (!foundBranch) {
        throw new ValidationError("Branch not found", { branch: data.branch });
      }
      branchIdUpdate.branchId = foundBranch.id;
    }
    const updated = await client.agent.update({
      where: { id },
      data: {
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber,
        ...branchIdUpdate,
        ...(data.attachment
          ? {
              attachments: {
                create: {
                  fileUrl: data.attachment.fileUrl,
                  fileName: data.attachment.fileName,
                  fileSize: typeof data.attachment.fileSize === "number" ? Math.floor(data.attachment.fileSize) : null,
                  mimeType: data.attachment.mimeType || null,
                },
              },
            }
          : {}),
      },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        isApproved: true,
        updatedAt: true,
      },
    });
    if (data.attachment) {
      await client.agentAttachment.create({
        data: {
          agentId: id,
          fileUrl: data.attachment.fileUrl,
          fileName: data.attachment.fileName || null,
          fileSize: typeof data.attachment.fileSize === "number" ? Math.floor(data.attachment.fileSize) : null,
          mimeType: data.attachment.mimeType || null,
        },
      });
    }
    return updated;
  }
  
  async updateStatus(id: string, isActive: boolean) {
    const client: any = prisma as any;
    const existing = await client.agent.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundError("Agent not found");
    }
    return client.agent.update({
      where: { id },
      data: { isActive },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        isApproved: true,
        updatedAt: true,
      },
    });
  }

  async updateApproval(id: string, isApproved: boolean) {
    const client: any = prisma as any;
    const existing = await client.agent.findUnique({ where: { id }, select: { id: true } });
    if (!existing) {
      throw new NotFoundError("Agent not found");
    }
    return client.agent.update({
      where: { id },
      data: { isApproved },
      select: {
        id: true,
        name: true,
        email: true,
        phoneNumber: true,
        isActive: true,
        isApproved: true,
        updatedAt: true,
      },
    });
  }
  
  async create(data: { name: string; email: string; phoneNumber: string; branch: string; attachment?: { fileUrl: string; fileName?: string; fileSize?: number; mimeType?: string } }) {
    if (!data.name || !data.email || !data.phoneNumber || !data.branch) {
      throw new ValidationError("name, email, phoneNumber, branch are required");
    }
    const client: any = prisma as any;
    const existing = await client.agent.findFirst({
      where: {
        OR: [
          { email: data.email },
          { phoneNumber: data.phoneNumber },
        ],
      },
      select: { id: true, email: true, phoneNumber: true },
    });
    if (existing) {
      if (existing.email === data.email) {
        throw new ValidationError("Agent with this email already exists", { field: "email" });
      }
      if (existing.phoneNumber === data.phoneNumber) {
        throw new ValidationError("Agent with this phone number already exists", { field: "phoneNumber" });
      }
      throw new ValidationError("Duplicate agent record", { email: data.email, phoneNumber: data.phoneNumber });
    }
    const foundBranch = await client.branch.findFirst({
      where: { name: { equals: data.branch, mode: "insensitive" } },
      select: { id: true, name: true },
    });
    if (!foundBranch) {
      throw new ValidationError("Branch not found", { branch: data.branch });
    }
    const created = await client.agent.create({
      data: {
        name: data.name,
        email: data.email,
        phoneNumber: data.phoneNumber,
        branchId: foundBranch.id,
        isApproved: true,
        attachments: data.attachment
          ? {
              create: {
                fileUrl: data.attachment.fileUrl,
                fileName: data.attachment.fileName,
                fileSize: typeof data.attachment.fileSize === "number" ? Math.floor(data.attachment.fileSize) : null,
                mimeType: data.attachment.mimeType || null,
              },
            }
          : undefined,
      },
      include: { attachments: true, branch: true },
    });

    // Send welcome email to the agent
    authService.sendOtp({
      email: created.email,
      phoneNumber: created.phoneNumber,
      purpose: OtpPurpose.AGENT_SET_PASSWORD
    }).catch(err => {
      // Log error but don't fail the agent creation
      console.error(`Failed to send welcome email to agent ${created.email}:`, err);
    });

    return created;
  }

  async transactions(agentId: string, filters: any = {}, page = 1, limit = 20) {
    const client: any = prisma as any;
    const agent = await client.agent.findUnique({ where: { id: agentId }, select: { id: true } });
    if (!agent) {
      throw new NotFoundError("Agent not found");
    }

    const where: any = { createdByAgentId: agentId };
    const search = (filters.search || filters.q || filters.keyword || "").toString().trim();
    if (filters.status) where.status = filters.status;
    const fromDate = (filters.dateFrom || filters.fromDate || "").toString().trim();
    const toDate = (filters.dateTo || filters.toDate || "").toString().trim();
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }
    if (search) {
      where.OR = [
        { referenceNumber: { contains: search, mode: "insensitive" } },
        { type: { contains: search.toUpperCase(), mode: "insensitive" } },
      ];
    }

    const skip = (page - 1) * limit;
    const [rows, total] = await Promise.all([
      client.transaction.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
        select: {
          id: true,
          status: true,
          currency: true,
          type: true,
          currentStep: true,
          referenceNumber: true,
          nairaEquivalent: true,
          foreignAmount: true,
          createdAt: true,
          cashPickup: {
            select: {
              id: true,
              status: true,
              currency: true,
              createdAt: true,
              pickupCode: true,
              pickupLocation: true,
              pickupLocationId: true,
              amount: true,
            },
          },
        },
      }),
      client.transaction.count({ where }),
    ]);
    const data = rows.map((r: any) => {
      const pickup = r.cashPickup || null;
      const value = Number(r.nairaEquivalent || r.foreignAmount || pickup?.amount || 0);
      return {
        transactionId: r.id,
        referenceNumber: r.referenceNumber || null,
        type: r.type || null,
        status: r.status || null,
        stage: r.currentStep || null,
        value,
        currency: r.currency || null,
        pickup: pickup
          ? {
              id: pickup.id,
              location: pickup.pickupLocation,
              locationId: pickup.pickupLocationId,
              code: pickup.pickupCode,
              status: pickup.status,
              createdAt: pickup.createdAt,
            }
          : null,
        createdAt: r.createdAt,
      };
    });
    return { data, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async exportTransactions(agentId: string, filters: any = {}) {
    const client: any = prisma as any;
    const agent = await client.agent.findUnique({ where: { id: agentId }, select: { id: true } });
    if (!agent) {
      throw new NotFoundError("Agent not found");
    }

    const where: any = { createdByAgentId: agentId };
    const search = (filters.search || filters.q || filters.keyword || "").toString().trim();
    if (filters.status) where.status = filters.status;
    const fromDate = (filters.dateFrom || filters.fromDate || "").toString().trim();
    const toDate = (filters.dateTo || filters.toDate || "").toString().trim();
    if (fromDate || toDate) {
      where.createdAt = {};
      if (fromDate) where.createdAt.gte = new Date(fromDate);
      if (toDate) where.createdAt.lte = new Date(toDate);
    }
    if (search) {
      where.OR = [
        { referenceNumber: { contains: search, mode: "insensitive" } },
        { type: { contains: search.toUpperCase(), mode: "insensitive" } },
      ];
    }

    const rows = await client.transaction.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10_000,
      select: {
        id: true,
        status: true,
        currency: true,
        type: true,
        currentStep: true,
        referenceNumber: true,
        nairaEquivalent: true,
        foreignAmount: true,
        createdAt: true,
        cashPickup: {
          select: {
            id: true,
            status: true,
            currency: true,
            createdAt: true,
            pickupCode: true,
            pickupLocation: true,
            pickupLocationId: true,
            amount: true,
          },
        },
      },
    });

    return rows.map((r: any) => {
      const pickup = r.cashPickup || null;
      const value = Number(r.nairaEquivalent || r.foreignAmount || pickup?.amount || 0);
      return {
        transactionId: r.id,
        referenceNumber: r.referenceNumber || null,
        type: r.type || null,
        status: r.status || null,
        stage: r.currentStep || null,
        value,
        currency: r.currency || null,
        pickup: pickup
          ? {
              id: pickup.id,
              location: pickup.pickupLocation,
              locationId: pickup.pickupLocationId,
              code: pickup.pickupCode,
              status: pickup.status,
              createdAt: pickup.createdAt,
            }
          : null,
        createdAt: r.createdAt,
      };
    });
  }

  /**
   * Full transaction detail (same shape as customer/agent GET transaction by id).
   */
  async transaction(agentId: string, transactionId: string) {
    const client: any = prisma as any;
    const agent = await client.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, email: true, phoneNumber: true },
    });
    if (!agent) throw new NotFoundError("Agent not found");

    const row = await client.transaction.findFirst({
      where: { id: transactionId, createdByAgentId: agentId },
      select: { id: true, userId: true },
    });
    if (!row) throw new NotFoundError("Transaction not found for this agent");

    const details = await customerTransactionService.getTransactionDetails(row.id, row.userId);

    // Helper to find document URL by type
    const getDocUrl = (type: string) => {
      const doc = details.requiredDocuments.find((d: any) => d.type === type);
      return doc?.uploaded?.fileUrl || null;
    };

    return {
      agentDetails: {
        agentId: agent.id,
        agentName: agent.name || "—",
        emailAddress: agent.email || "—",
        phoneNumber: agent.phoneNumber || "—",
      },
      transactionDetails: {
        transactionId: details.referenceNumber,
        transactionType: details.type || "—",
        currency: details.currency || "—",
        amountNgn: details.nairaEquivalent || "—",
        equivalentAmount: details.foreignAmount ? `${details.currency} ${Number(details.foreignAmount).toLocaleString(undefined, { minimumFractionDigits: 2 })}` : "—",
        exchangeRate: details.exchangeRate || "—",
        dateInitiated: details.createdAt,
        timeInitiated: details.createdAt,
        purpose: details.purpose || "—",
        destinationCountry: details.destinationCountry || "—",
        formAId: details.formAId || "—",
        disbursementMethod: details.disbursementMethod || "—",
        status: details.status || "—",
        currentStep: details.currentStep || "—",
      },
      requiredDocuments: {
        bvn: details.personalInfo?.bvn || "—",
        nin: details.personalInfo?.nin || "—",
        tin: details.personalInfo?.tinNumber || "—",
        taxClearanceNumber: details.taxClearanceNumber || "—",
        documentsCount: details.requiredDocuments.filter((d: any) => d.uploaded).length,
        visa: getDocUrl('VISA'),
        returnTicket: getDocUrl('RETURN_TICKET'),
        passport: getDocUrl('PASSPORT'),
        schoolAdmission: getDocUrl('SCHOOL_ADMISSION'),
        invoice: getDocUrl('INVOICE'),
        receipt: getDocUrl('RECEIPT'),
      },
      paymentDetails: {
        transactionId: details.transactionId,
        transactionDate: details.createdAt,
        transactionTime: details.createdAt,
        transactionReceipt: getDocUrl('RECEIPT'),
        paidTo: details.settlement?.bankDetails?.accountName || "—",
        bankName: details.settlement?.bankDetails?.bankName || "—",
      },
      transactionSettlement: {
        settlementId: details.settlement?.id || "—",
        settlementDate: details.settlement?.depositedAt || details.settlement?.createdAt || "—",
        settlementTime: details.settlement?.depositedAt || details.settlement?.createdAt || "—",
        settlementReceipt: details.settlement?.proofOfPayment || "—",
        settlementStructureCash: "—",
        settlementStructurePrepaidCard: "—",
        seventyFivePercentPaidInto: "—",
        settlementStatus: details.currentStep || details.status,
      },
      raw: details
    };
  }

  async getReceiptDownload(agentId: string, transactionId: string) {
    const client: any = prisma as any;
    const agent = await client.agent.findUnique({ where: { id: agentId }, select: { id: true } });
    if (!agent) throw new NotFoundError("Agent not found");

    const trx = await client.transaction.findFirst({
      where: { id: transactionId, createdByAgentId: agentId },
      select: {
        id: true,
        receipt: { select: { receiptNumber: true, pdfUrl: true } },
        documents: {
          where: { documentType: "RECEIPT" },
          select: { fileUrl: true, fileName: true },
          take: 1,
        },
      },
    });
    if (!trx) throw new NotFoundError("Transaction not found for this agent");

    const [settlement, paymentReceipt] = await Promise.all([
      prisma.settlement.findUnique({
        where: { transactionId: transactionId }
      }).catch(() => null),
      (prisma as any).paymentReceipt.findFirst({
        where: { transactionId: transactionId },
        orderBy: { generatedAt: "desc" }
      }).catch(() => null)
    ]);

    let pdfUrl = (trx as any).receipt?.pdfUrl || null;
    let filename = (trx as any).receipt?.receiptNumber ? `receipt-${(trx as any).receipt.receiptNumber}.pdf` : null;

    if (!pdfUrl && trx.documents && trx.documents.length > 0) {
      pdfUrl = trx.documents[0].fileUrl;
      filename = trx.documents[0].fileName || `receipt-${transactionId}`;
    }

    if (!pdfUrl && paymentReceipt) {
      pdfUrl = paymentReceipt.pdfUrl;
      filename = paymentReceipt.receiptNumber ? `receipt-${paymentReceipt.receiptNumber}.pdf` : null;
    }

    if (!pdfUrl && settlement?.proofOfPayment) {
      pdfUrl = settlement.proofOfPayment;
      filename = settlement.paymentReference ? `receipt-${settlement.paymentReference}.pdf` : null;
    }

    if (!pdfUrl) throw new NotFoundError("Receipt not available for this transaction");

    return {
      url: pdfUrl,
      filename: filename || `receipt-${transactionId}.pdf`,
    };
  }

  async getDocumentDownload(agentId: string, transactionId: string, documentId: string) {
    const client: any = prisma as any;
    const agent = await client.agent.findUnique({ where: { id: agentId }, select: { id: true } });
    if (!agent) throw new NotFoundError("Agent not found");

    const doc = await client.transactionDocument.findFirst({
      where: {
        id: documentId,
        transactionId,
        transaction: { createdByAgentId: agentId },
      },
      select: { id: true, fileUrl: true, fileName: true, documentType: true },
    });
    if (!doc) throw new NotFoundError("Document not found for this transaction");
    if (!doc.fileUrl) throw new NotFoundError("Document file not available");

    return {
      url: doc.fileUrl,
      filename: doc.fileName || `${doc.documentType}-${doc.id}`,
    };
  }
}

export const agentService = new AgentService();
