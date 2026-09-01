import { getDatabase } from "../../../config/database";
import authService from "../../auth/services/auth.service";
import { NotFoundError, ValidationError, validatePhoneNumber } from "../../../shared/utils";
import {
  AgentCreateNigerianCustomerAccountRequest,
  AgentCustomerDetailsResponse,
  AgentCustomerListFilters,
  AgentCustomerSegment,
  AgentCustomerStatsResponse,
  AgentCustomerTransactionListItem,
  AgentUpdateCustomerRequest,
  CustomerType,
  CustomerFile,
  KycStatus,
  UserRole,
} from "../../../shared/types";
import { DocumentType } from "../../../shared/types/common";
import { TransactionType, TransactionStatus } from "../../../shared/types/transaction";

const prisma = getDatabase();

export class AgentCustomerService {
  async createNigerianCustomerAccountForAgent(
    data: AgentCreateNigerianCustomerAccountRequest,
    agentUserId: string,
  ): Promise<{ userId: string; message: string }> {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can create customers");
    }

    const agent = await (prisma as any).agent.findUnique({
      where: { email: agentUser.email },
    });

    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    const baseResult = await authService.createNigerianAccount({
      verificationToken: data.verificationToken,
      password: data.password,
    });

    let desiredCustomerType: CustomerType = CustomerType.NIGERIAN_CITIZEN;
    if (data.customerType) {
      if (!Object.values(CustomerType).includes(data.customerType)) {
        throw new ValidationError("Invalid customerType");
      }
      desiredCustomerType = data.customerType;
    }

    await (prisma as any).user.update({
      where: { id: baseResult.userId },
      data: {
        createdByAgentId: agent.id,
        customerType: desiredCustomerType,
      },
    });

    return {
      userId: baseResult.userId,
      message: baseResult.message,
    };
  }

  async createTouristCustomerAccountForAgent(
    data: { verificationToken: string; password: string },
    agentUserId: string,
  ): Promise<{ userId: string; message: string }> {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can create customers");
    }

    const agent = await (prisma as any).agent.findUnique({
      where: { email: agentUser.email },
    });

    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    const baseResult = await authService.createTouristAccount(data);

    await (prisma as any).user.update({
      where: { id: baseResult.userId },
      data: { createdByAgentId: agent.id },
    });

    return baseResult;
  }

  async createExpatriateCustomerAccountForAgent(
    data: { verificationToken: string; password: string },
    agentUserId: string,
  ): Promise<{ userId: string; message: string }> {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can create customers");
    }

    const agent = await (prisma as any).agent.findUnique({
      where: { email: agentUser.email },
    });

    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    const baseResult = await authService.createExpatriateAccount(data);

    await (prisma as any).user.update({
      where: { id: baseResult.userId },
      data: { createdByAgentId: agent.id },
    });

    return baseResult;
  }

  async listAgentCustomers(
    agentUserId: string,
    filters: AgentCustomerListFilters,
    page: number,
    limit: number,
  ): Promise<{
    data: import("../../../shared/types").AgentCustomerSummary[];
    meta: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can view their customers");
    }

    const agent = await (prisma as any).agent.findUnique({
      where: { email: agentUser.email },
    });

    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    const where: any = {
      createdByAgentId: agent.id,
    };

    if (filters.customerType && Object.values(CustomerType).includes(filters.customerType as CustomerType)) {
      where.customerType = filters.customerType;
    }

    if (filters.search) {
      const search = filters.search.trim();
      if (search) {
        where.OR = [
          { id: search },
          { email: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search, mode: "insensitive" } },
          {
            profile: {
              is: {
                OR: [
                  { firstName: { contains: search, mode: "insensitive" } },
                  { lastName: { contains: search, mode: "insensitive" } },
                ],
              },
            },
          },
        ];
      }
    }

    if (filters.fromDate || filters.toDate) {
      const createdAt: any = {};
      if (filters.fromDate) {
        const d = new Date(filters.fromDate);
        if (!isNaN(d.getTime())) createdAt.gte = d;
      }
      if (filters.toDate) {
        const d = new Date(filters.toDate);
        if (!isNaN(d.getTime())) createdAt.lte = d;
      }
      if (createdAt.gte || createdAt.lte) {
        where.createdAt = createdAt;
      }
    }

    const users = await (prisma as any).user.findMany({
      where,
      include: {
        profile: true,
        kyc: true,
      },
      orderBy: { createdAt: "desc" },
    });

    // Enrich with last transaction type
    const enriched = await Promise.all(
      users.map(async (user: any) => {
        const lastTx = await (prisma as any).transaction.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          select: { type: true, createdAt: true },
        });

        return {
          ...user,
          lastTransactionType: lastTx?.type as TransactionType | undefined,
          lastTransactionDate: lastTx?.createdAt as Date | undefined,
        };
      }),
    );

    let filtered = enriched;

    if (filters.status && Object.values(KycStatus).includes(filters.status as KycStatus)) {
      const desiredStatus = filters.status as KycStatus;
      filtered = filtered.filter((u) => u.kyc?.status === desiredStatus);
    }

    if (
      filters.lastTransactionType &&
      Object.values(TransactionType).includes(filters.lastTransactionType as TransactionType)
    ) {
      const desiredType = filters.lastTransactionType as TransactionType;
      filtered = filtered.filter((u) => u.lastTransactionType === desiredType);
    }

    if (
      filters.segment &&
      Object.values(AgentCustomerSegment).includes(filters.segment as AgentCustomerSegment) &&
      filters.segment !== AgentCustomerSegment.ALL
    ) {
      if (filters.segment === AgentCustomerSegment.VERIFIED) {
        filtered = filtered.filter((u) => u.kyc?.status === KycStatus.VERIFIED);
      } else if (filters.segment === AgentCustomerSegment.PENDING_KYC) {
        // Matches getCustomerStats' pendingKyc definition
        filtered = filtered.filter(
          (u) =>
            !!u.kyc &&
            ![KycStatus.VERIFIED, KycStatus.REJECTED, KycStatus.IN_PROGRESS, KycStatus.NOT_STARTED].includes(
              u.kyc.status as KycStatus,
            ),
        );
      } else if (filters.segment === AgentCustomerSegment.RETURNING) {
        const completedCounts = await (prisma as any).transaction.groupBy({
          by: ["userId"],
          where: {
            userId: { in: filtered.map((u) => u.id) },
            status: TransactionStatus.COMPLETED,
          },
          _count: { _all: true },
        });
        const returningUserIds = new Set(
          completedCounts.filter((g: any) => (g._count?._all ?? 0) >= 2).map((g: any) => g.userId),
        );
        filtered = filtered.filter((u) => returningUserIds.has(u.id));
      }
    }

    const total = filtered.length;
    const totalPages = Math.max(1, Math.ceil(total / limit) || 1);
    const safePage = Math.max(1, page);
    const start = (safePage - 1) * limit;
    const paged = filtered.slice(start, start + limit);

    const items = paged.map((user: any) => {
      const fullName = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim();
      return {
        userId: user.id,
        fullName,
        customerType: user.customerType as CustomerType | undefined,
        lastTransactionType: (user.lastTransactionType as TransactionType | undefined) ?? null,
        lastTransactionDate: user.lastTransactionDate ? (user.lastTransactionDate as Date).toISOString() : null,
        registeredAt: user.createdAt.toISOString(),
        kycStatus: user.kyc?.status as KycStatus | undefined,
        nin: user.kyc?.nin ?? null,
        bvn: user.kyc?.bvn ?? null,
      };
    });

    return {
      data: items,
      meta: {
        page: safePage,
        limit,
        total,
        totalPages,
      },
    };
  }

  async getAgentCustomerDetails(
    agentUserId: string,
    userId: string,
  ): Promise<AgentCustomerDetailsResponse> {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can view their customers");
    }

    const agent = await (prisma as any).agent.findUnique({
      where: { email: agentUser.email },
    });
    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    const user = await (prisma as any).user.findFirst({
      where: { id: userId, createdByAgentId: agent.id },
      include: { profile: true, kyc: true },
    });
    if (!user) {
      throw new NotFoundError("Customer not found or not created by this agent");
    }

    const fullName = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim();
    const registeredAt = user.createdAt.toISOString();
    const dateOnboarded = user.kyc?.verifiedAt
      ? user.kyc.verifiedAt.toISOString()
      : null;

    const [totalTransactionsCompleted, latestFormATx, documents] = await Promise.all([
      prisma.transaction.count({
        where: { userId, status: TransactionStatus.COMPLETED },
      }),
      prisma.transaction.findFirst({
        where: {
          userId,
          status: TransactionStatus.COMPLETED,
          formAId: { not: null },
        },
        orderBy: { createdAt: "desc" },
        select: { formAId: true },
      }),
      prisma.transactionDocument.findMany({
        where: {
          transaction: { userId },
          documentType: {
            in: [
              DocumentType.FORM_A_DOCUMENT,
              DocumentType.UTILITY_BILL,
              DocumentType.VISA,
              DocumentType.RETURN_TICKET,
            ],
          },
        },
        orderBy: { uploadedAt: "desc" },
        select: {
          id: true,
          documentType: true,
          fileUrl: true,
          fileName: true,
          fileSize: true,
          uploadedAt: true,
        },
      }),
    ]);

    const formAId = latestFormATx?.formAId ?? null;

    let idType: string | null = null;
    if (user.kyc) {
      if (user.kyc.passportNumber) idType = "PASSPORT";
      else if (user.kyc.bvn) idType = "BVN";
      else if (user.kyc.nin) idType = "NIN";
      else if (user.kyc.tin) idType = "TIN";
    }

    const toCustomerFile = (doc: any): CustomerFile => ({
      id: doc.id,
      documentType: doc.documentType,
      fileUrl: doc.fileUrl,
      fileName: doc.fileName,
      fileSize: doc.fileSize,
      uploadedAt: doc.uploadedAt.toISOString(),
    });

    const latestByType: Record<string, CustomerFile> = {};
    for (const doc of documents) {
      const type = doc.documentType as string;
      if (!latestByType[type]) {
        latestByType[type] = toCustomerFile(doc);
      }
    }

    return {
      userId: user.id,
      registeredAt,
      fullName,
      email: user.email,
      dateOnboarded,
      totalTransactionsCompleted,
      idDetails: {
        idType,
        nin: user.kyc?.nin ?? null,
        bvn: user.kyc?.bvn ?? null,
        tin: user.kyc?.tin ?? null,
        formAId,
      },
      files: {
        FormA: latestByType[DocumentType.FORM_A_DOCUMENT] ?? null,
        utilityBill: latestByType[DocumentType.UTILITY_BILL] ?? null,
        Visa: latestByType[DocumentType.VISA] ?? null,
        ReturnTicket: latestByType[DocumentType.RETURN_TICKET] ?? null,
      },
    };
  }

  async getCustomerStats(agentUserId: string): Promise<AgentCustomerStatsResponse> {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can view their customer stats");
    }

    const agent = await (prisma as any).agent.findUnique({
      where: { email: agentUser.email },
    });

    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    const [totalCustomers, verifiedCustomers, pendingKyc, repeatCustomers] = await Promise.all([
      prisma.user.count({
        where: { createdByAgentId: agent.id, role: UserRole.CUSTOMER },
      }),
      prisma.user.count({
        where: {
          createdByAgentId: agent.id,
          role: UserRole.CUSTOMER,
          kyc: { status: KycStatus.VERIFIED },
        },
      }),
      prisma.user.count({
        where: {
          createdByAgentId: agent.id,
          role: UserRole.CUSTOMER,
          kyc: {
            status: {
              notIn: [
                KycStatus.VERIFIED,
                KycStatus.REJECTED,
                KycStatus.IN_PROGRESS,
                KycStatus.NOT_STARTED,
              ],
            },
          },
        },
      }),
      (prisma as any).transaction
        .groupBy({
          by: ["userId"],
          where: {
            createdByAgentId: agent.id,
            status: TransactionStatus.COMPLETED,
          },
          _count: { _all: true },
        })
        .then((groups: any[]) => groups.filter((g) => (g._count?._all ?? 0) >= 2).length),
    ]);

    return {
      totalCustomers,
      verifiedCustomers,
      repeatCustomers,
      pendingKyc,
    };
  }

  async listCustomerTransactions(
    agentUserId: string,
    customerId: string,
    page: number,
    limit: number
  ): Promise<{
    data: AgentCustomerTransactionListItem[];
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }> {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can view their customers");
    }

    const agent = await (prisma as any).agent.findUnique({
      where: { email: agentUser.email },
    });
    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    const customer = await (prisma as any).user.findFirst({
      where: { id: customerId, createdByAgentId: agent.id },
      select: { id: true },
    });
    if (!customer) {
      throw new NotFoundError("Customer not found or not created by this agent");
    }

    const safeLimit = Math.min(Math.max(limit, 1), 100);
    const safePage = Math.max(1, page);
    const skip = (safePage - 1) * safeLimit;

    const [rows, total] = await Promise.all([
      prisma.transaction.findMany({
        where: { userId: customerId },
        select: {
          id: true,
          createdAt: true,
          type: true,
          status: true,
          referenceNumber: true,
          currency: true,
          foreignAmount: true,
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: safeLimit,
      }),
      prisma.transaction.count({ where: { userId: customerId } }),
    ]);

    const data: AgentCustomerTransactionListItem[] = rows.map((t) => ({
      transactionId: t.id,
      transactionDate: t.createdAt.toISOString(),
      transactionType: t.type,
      transactionStatus: t.status,
      transactionReferenceNumber: t.referenceNumber,
      currency: t.currency,
      foreignAmount: t.foreignAmount != null ? Number(t.foreignAmount) : null,
    }));

    return {
      data,
      pagination: {
        page: safePage,
        limit: safeLimit,
        total,
        totalPages: Math.ceil(total / safeLimit) || 1,
      },
    };
  }

  async exportAgentCustomers(
    agentUserId: string,
    filters: { search?: string; status?: string; customerType?: string; fromDate?: string; toDate?: string } = {}
  ): Promise<string> {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can export their customers");
    }

    const agent = await (prisma as any).agent.findUnique({ where: { email: agentUser.email } });
    if (!agent) throw new ValidationError("Agent profile not found");

    const where: any = { createdByAgentId: agent.id, role: UserRole.CUSTOMER };

    if (filters.customerType && Object.values(CustomerType).includes(filters.customerType as CustomerType)) {
      where.customerType = filters.customerType;
    }

    if (filters.search) {
      const search = filters.search.trim();
      if (search) {
        where.OR = [
          { id: search },
          { email: { contains: search, mode: "insensitive" } },
          { phoneNumber: { contains: search, mode: "insensitive" } },
          { profile: { is: { OR: [{ firstName: { contains: search, mode: "insensitive" } }, { lastName: { contains: search, mode: "insensitive" } }] } } },
        ];
      }
    }

    if (filters.fromDate || filters.toDate) {
      const createdAt: any = {};
      if (filters.fromDate) { const d = new Date(filters.fromDate); if (!isNaN(d.getTime())) createdAt.gte = d; }
      if (filters.toDate)   { const d = new Date(filters.toDate);   if (!isNaN(d.getTime())) createdAt.lte = d; }
      if (createdAt.gte || createdAt.lte) where.createdAt = createdAt;
    }

    const users = await (prisma as any).user.findMany({
      where,
      include: { profile: true, kyc: true },
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });

    // Optionally filter by KYC status (post-query since kyc is a relation)
    const desiredStatus = filters.status as KycStatus | undefined;
    const filtered = desiredStatus && Object.values(KycStatus).includes(desiredStatus)
      ? users.filter((u: any) => u.kyc?.status === desiredStatus)
      : users;

    // Enrich with last transaction date
    const enriched = await Promise.all(
      filtered.map(async (user: any) => {
        const lastTx = await (prisma as any).transaction.findFirst({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          select: { type: true, createdAt: true },
        });
        return { ...user, lastTransactionType: lastTx?.type ?? null, lastTransactionDate: lastTx?.createdAt ?? null };
      })
    );

    const escape = (v: unknown) => {
      if (v == null) return "";
      const s = String(v);
      return /[,"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };

    const headers = ["Customer ID", "Full Name", "Email", "Phone Number", "Customer Type", "KYC Status", "BVN", "NIN", "Last Transaction Type", "Last Transaction Date", "Registered At"];
    const rows = enriched.map((user: any) => {
      const fullName = `${user.profile?.firstName || ""} ${user.profile?.lastName || ""}`.trim();
      return [
        user.id,
        fullName,
        user.email,
        user.phoneNumber ?? "",
        user.customerType ?? "",
        user.kyc?.status ?? "",
        user.kyc?.bvn ?? "",
        user.kyc?.nin ?? "",
        user.lastTransactionType ?? "",
        user.lastTransactionDate ? (user.lastTransactionDate as Date).toISOString() : "",
        user.createdAt.toISOString(),
      ].map(escape).join(",");
    });

    return [headers.join(","), ...rows].join("\n");
  }

  async updateAgentCustomerDetails(
    agentUserId: string,
    userId: string,
    payload: AgentUpdateCustomerRequest,
  ): Promise<{
    userId: string;
    fullName: string;
    phoneNumber: string;
    customerType?: CustomerType;
    kycStatus?: KycStatus;
  }> {
    const agentUser = await prisma.user.findUnique({ where: { id: agentUserId } });
    if (!agentUser || agentUser.role !== UserRole.AGENT) {
      throw new ValidationError("Only agents can update their customers");
    }

    const agent = await (prisma as any).agent.findUnique({
      where: { email: agentUser.email },
    });

    if (!agent) {
      throw new ValidationError("Agent profile not found");
    }

    const existingCustomer = await (prisma as any).user.findFirst({
      where: { id: userId, createdByAgentId: agent.id },
      include: { profile: true, kyc: true },
    });

    if (!existingCustomer) {
      throw new NotFoundError("Customer not found or not created by this agent");
    }

    const updates: AgentUpdateCustomerRequest = {};

    if (typeof payload.firstName === "string") {
      const trimmed = payload.firstName.trim();
      if (trimmed.length === 0) {
        throw new ValidationError("firstName cannot be empty when provided");
      }
      updates.firstName = trimmed;
    }

    if (typeof payload.lastName === "string") {
      const trimmed = payload.lastName.trim();
      if (trimmed.length === 0) {
        throw new ValidationError("lastName cannot be empty when provided");
      }
      updates.lastName = trimmed;
    }

    if (typeof payload.phoneNumber === "string") {
      const trimmed = payload.phoneNumber.trim();
      if (trimmed.length === 0) {
        throw new ValidationError("phoneNumber cannot be empty when provided");
      }
      if (!validatePhoneNumber(trimmed)) {
        throw new ValidationError("Invalid phone number format");
      }
      updates.phoneNumber = trimmed;
    }

    if (
      updates.firstName === undefined &&
      updates.lastName === undefined &&
      updates.phoneNumber === undefined
    ) {
      throw new ValidationError("No valid fields to update");
    }

    const userData: any = {};
    if (updates.phoneNumber !== undefined) {
      userData.phoneNumber = updates.phoneNumber;
    }

    const profileData: any = {};
    if (updates.firstName !== undefined) {
      profileData.firstName = updates.firstName;
    }
    if (updates.lastName !== undefined) {
      profileData.lastName = updates.lastName;
    }

    await prisma.$transaction(async (tx) => {
      if (Object.keys(userData).length > 0) {
        await tx.user.update({
          where: { id: userId },
          data: userData,
        });
      }

      if (Object.keys(profileData).length > 0) {
        if (existingCustomer.profile) {
          await tx.userProfile.update({
            where: { userId },
            data: profileData,
          });
        } else {
          await tx.userProfile.create({
            data: {
              userId,
              ...profileData,
            },
          });
        }
      }
    });

    const updated = await (prisma as any).user.findUnique({
      where: { id: userId },
      include: { profile: true, kyc: true },
    });

    const fullName = `${updated?.profile?.firstName || ""} ${updated?.profile?.lastName || ""}`.trim();

    return {
      userId: updated.id,
      fullName,
      phoneNumber: updated.phoneNumber,
      customerType: updated.customerType as CustomerType | undefined,
      kycStatus: updated.kyc?.status as KycStatus | undefined,
    };
  }
}

const agentCustomerService = new AgentCustomerService();
export default agentCustomerService;

