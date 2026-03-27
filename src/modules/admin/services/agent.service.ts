import { PrismaClient } from "@prisma/client";
import { getDatabase } from "../../../config/database";
import { ValidationError, NotFoundError } from "../../../shared/utils/errors";

const prisma: PrismaClient = getDatabase();

class AgentService {
  async stats() {
    const client: any = prisma as any;
    const [total, active, deactivated, pendingApproval] = await Promise.all([
      client.agent.count(),
      client.agent.count({ where: { isActive: true, isApproved: true } }),
      client.agent.count({ where: { isActive: false, isApproved: true } }),
      client.agent.count({ where: { isApproved: false } }),
    ]);
    return { total, active, deactivated, pendingApproval };
  }

  async listAll(filters: any = {}) {
    const search = (((filters || {}).search ?? (filters || {}).q) || "").toString().trim();
    const where: any = {};
    if (filters.isActive !== undefined) where.isActive = String(filters.isActive) === "true";
    if (filters.isApproved !== undefined) where.isApproved = String(filters.isApproved) === "true";
    const branchRaw = ((filters || {}).branch ?? (filters || {}).branchId ?? "").toString().trim();
    if (branchRaw) {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchRaw);
      if (isUuid) {
        where.branchId = branchRaw;
      } else {
        const branch = await (prisma as any).branch.findFirst({
          where: { name: { equals: branchRaw, mode: "insensitive" } },
          select: { id: true },
        });
        if (!branch) {
          throw new ValidationError("Branch not found", { branch: branchRaw });
        }
        where.branchId = branch.id;
      }
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }

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
    const search = (((filters || {}).search ?? (filters || {}).q) || "").toString().trim();
    const where: any = {};
    if (filters.isActive !== undefined) where.isActive = filters.isActive === "true";
    const fromDateRaw = (filters.fromDate || "").toString().trim();
    const toDateRaw = (filters.toDate || "").toString().trim();
    const createdRange: any = {};
    if (fromDateRaw) {
      const d = new Date(fromDateRaw);
      if (!isNaN(d.getTime())) createdRange.gte = d;
    }
    if (toDateRaw) {
      const d = new Date(toDateRaw);
      if (!isNaN(d.getTime())) createdRange.lte = d;
    }
    if (createdRange.gte || createdRange.lte) {
      where.createdAt = createdRange;
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }
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
        totalTransactions: totals.count,
        totalTransactionsVolume: totals.volume,
      };
    });

    return { data: enriched, meta: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }
  
  async export(filters: any = {}) {
    const where: any = {};
    const search = (((filters || {}).search ?? (filters || {}).q) || "").toString().trim();
    if (filters.isActive !== undefined) where.isActive = String(filters.isActive) === "true";
    const branchRaw = ((filters || {}).branch ?? (filters || {}).branchId ?? "").toString().trim();
    if (branchRaw) {
      const isUuid =
        /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(branchRaw);
      if (isUuid) {
        where.branchId = branchRaw;
      } else {
        const branch = await (prisma as any).branch.findFirst({
          where: { name: { equals: branchRaw, mode: "insensitive" } },
          select: { id: true },
        });
        if (!branch) {
          throw new ValidationError("Branch not found", { branch: branchRaw });
        }
        where.branchId = branch.id;
      }
    }
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }
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
    return { ...rest, totalTransactions, totalTransactionsVolume };
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
        isApproved: false,
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
    return created;
  }

  async transactions(agentId: string, filters: any = {}, page = 1, limit = 20) {
    const client: any = prisma as any;
    const agent = await client.agent.findUnique({ where: { id: agentId }, select: { id: true } });
    if (!agent) {
      throw new NotFoundError("Agent not found");
    }

    const where: any = { createdByAgentId: agentId };
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
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
    if (filters.status) where.status = filters.status;
    if (filters.dateFrom || filters.dateTo) {
      where.createdAt = {};
      if (filters.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters.dateTo) where.createdAt.lte = new Date(filters.dateTo);
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

  async transaction(agentId: string, transactionId: string) {
    const client: any = prisma as any;
    const agent = await client.agent.findUnique({
      where: { id: agentId },
      select: { id: true, name: true, email: true, phoneNumber: true },
    });
    if (!agent) throw new NotFoundError("Agent not found");
    const row = await client.transaction.findFirst({
      where: { id: transactionId, createdByAgentId: agentId },
      select: {
        id: true,
        referenceNumber: true,
        type: true,
        status: true,
        currentStep: true,
        currency: true,
        createdAt: true,
        updatedAt: true,
        destinationCountry: true,
        nairaEquivalent: true,
        foreignAmount: true,
        userId: true,
        documents: { select: { id: true, documentType: true, fileName: true, fileUrl: true } },
        cashPickup: {
          select: {
            id: true,
            status: true,
            currency: true,
            createdAt: true,
            pickupCode: true,
            pickupLocation: true,
            pickupLocationId: true,
            pickupCity: true,
            pickupState: true,
            amount: true,
          },
        },
        receipt: { select: { id: true, receiptNumber: true, pdfUrl: true, generatedAt: true } },
      },
    });
    if (!row) throw new NotFoundError("Transaction not found for this agent");
    const pickup = (row as any).cashPickup || null;
    const currency = (row.currency || "").toString().trim();
    let nairaEquivalent = Number(row.nairaEquivalent || 0);
    let foreignAmount = Number(row.foreignAmount || 0);
    const pickupAmount = Number(pickup?.amount || 0);
    if (currency.toUpperCase() === "NGN" && nairaEquivalent === 0 && foreignAmount > 0) {
      nairaEquivalent = foreignAmount;
      foreignAmount = 0;
    }
    const value = Number(nairaEquivalent || foreignAmount || pickupAmount || 0);
    const docCount = Array.isArray((row as any).documents) ? (row as any).documents.length : 0;
    const documents =
      ((row as any).documents || []).map((d: any) => ({
        id: d.id,
        type: d.documentType,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
      })) || [];

    const user = await client.user.findUnique({
      where: { id: row.userId },
      select: {
        kyc: { select: { bvn: true, tin: true } },
        profile: { select: { firstName: true, lastName: true } },
      },
    });
    const customerName =
      user?.profile ? `${user.profile.firstName || ""} ${user.profile.lastName || ""}`.trim() : null;
    const bvn = user?.kyc?.bvn || null;
    const tin = user?.kyc?.tin || null;

    const settlement = await client.settlement.findUnique({
      where: { transactionId: row.id },
      select: {
        id: true,
        status: true,
        paymentMethod: true,
        amount: true,
        currency: true,
        confirmedAt: true,
        proofOfPayment: true,
        bankDetails: { select: { bankName: true, accountName: true, accountNumber: true, reference: true } },
      },
    });

    return {
      transactionId: row.id,
      referenceNumber: row.referenceNumber || null,
      type: row.type || null,
      status: row.status || null,
      stage: row.currentStep || null,
      currency: row.currency || null,
      amounts: {
        nairaEquivalent,
        foreignAmount,
        pickupAmount,
        value,
      },
      pickup: pickup
        ? {
            id: pickup.id,
            location: pickup.pickupLocation,
            locationId: pickup.pickupLocationId,
            code: pickup.pickupCode,
            status: pickup.status,
            createdAt: pickup.createdAt,
            address: [pickup.pickupLocation, pickup.pickupCity, pickup.pickupState].filter(Boolean).join(", "),
          }
        : null,
      agent: {
        id: agent.id,
        name: agent.name || null,
        email: agent.email || null,
        phoneNumber: agent.phoneNumber || null,
      },
      customer: {
        name: customerName,
        bvn,
        tin,
      },
      receipt: row.receipt
        ? {
            receiptNumber: (row as any).receipt?.receiptNumber,
            pdfUrl: (row as any).receipt?.pdfUrl || null,
            generatedAt: (row as any).receipt?.generatedAt || null,
          }
        : null,
      settlement: settlement
        ? {
            id: settlement.id,
            status: settlement.status,
            paymentMethod: settlement.paymentMethod,
            amount: Number(settlement.amount || 0),
            currency: settlement.currency,
            confirmedAt: settlement.confirmedAt || null,
            proofOfPayment: settlement.proofOfPayment || null,
            bankDetails: settlement.bankDetails || null,
          }
        : null,
      meta: {
        documents: { count: docCount },
        documentsList: documents,
        destinationCountry: row.destinationCountry || null,
      },
      createdAt: row.createdAt,
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
      },
    });
    if (!trx) throw new NotFoundError("Transaction not found for this agent");
    const pdfUrl = (trx as any).receipt?.pdfUrl || null;
    if (!pdfUrl) throw new NotFoundError("Receipt not available for this transaction");

    const receiptNumber = (trx as any).receipt?.receiptNumber || null;
    return {
      url: pdfUrl,
      filename: `receipt-${receiptNumber || transactionId}.pdf`,
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
