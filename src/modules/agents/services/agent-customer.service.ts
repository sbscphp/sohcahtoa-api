import { getDatabase } from "../../../config/database";
import authService from "../../auth/services/auth.service";
import { ValidationError } from "../../../shared/utils";
import {
  AgentCreateNigerianCustomerAccountRequest,
  AgentCustomerListFilters,
  CustomerType,
  KycStatus,
  UserRole,
} from "../../../shared/types";
import { TransactionType } from "../../../shared/types/transaction";

const prisma = getDatabase();

class AgentCustomerService {
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
          select: { type: true },
        });

        return {
          ...user,
          lastTransactionType: lastTx?.type as TransactionType | undefined,
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
        registeredAt: user.createdAt.toISOString(),
        kycStatus: user.kyc?.status as KycStatus | undefined,
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
}

const agentCustomerService = new AgentCustomerService();
export default agentCustomerService;

