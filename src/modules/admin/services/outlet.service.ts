import { getDatabase } from "../../../config/database";
import { createLogger, NotFoundError, ValidationError } from "../../../shared/utils";
import { ServiceName } from "../../../shared/types";
import {
  CreateFranchiseDto,
  FranchiseQueryDto,
  CreateBranchDto,
  UpdateFranchiseDto,
  CreatePickupStationDto,
  PickupStationQueryDto,
  UpdatePickupStationDto,
} from "../dto/outlet.dto";

const prisma = getDatabase();
const logger = createLogger(ServiceName.ADMIN);
const db: any = prisma;

class OutletService {
  async listOutlets() {
    const locations = await prisma.cashPickup.findMany({
      select: { pickupLocation: true },
      distinct: ["pickupLocation"],
    });

    const results = await Promise.all(
      locations.map(async (loc) => {
        const name = loc.pickupLocation;
        const [total, pending, pickedUp, last] = await Promise.all([
          prisma.cashPickup.count({ where: { pickupLocation: name } }),
          prisma.cashPickup.count({ where: { pickupLocation: name, status: "PENDING" } }),
          prisma.cashPickup.count({ where: { pickupLocation: name, status: "COMPLETED" } }),
          prisma.cashPickup.findFirst({
            where: { pickupLocation: name },
            orderBy: { updatedAt: "desc" },
            select: { updatedAt: true },
          }),
        ]);
        return {
          name,
          total,
          pending,
          completed: pickedUp,
          lastActivityAt: last?.updatedAt || null,
        };
      })
    );

    return results;
  }

  async getOutlet(name: string) {
    const [summary, recent] = await Promise.all([
      (async () => {
        const [total, pending, completed] = await Promise.all([
          prisma.cashPickup.count({ where: { pickupLocation: name } }),
          prisma.cashPickup.count({ where: { pickupLocation: name, status: "PENDING" } }),
          prisma.cashPickup.count({ where: { pickupLocation: name, status: "COMPLETED" } }),
        ]);
        return { name, total, pending, completed };
      })(),
      prisma.cashPickup.findMany({
        where: { pickupLocation: name },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: {
          id: true,
          transactionId: true,
          recipientName: true,
          recipientPhone: true,
          amount: true,
          currency: true,
          status: true,
          updatedAt: true,
        },
      }),
    ]);

    return { summary, recent };
  }

  async getFranchiseStats() {
    const total = await db.franchise.count();
    const active = await db.franchise.count({ where: { status: "Active" } });
    const deactivated = await db.franchise.count({ where: { status: "Deactivated" } });
    const pendingApproval = await db.franchise.count({ where: { status: "PENDING" } });
    return { total, active, deactivated, pendingApproval };
  }

  async listFranchises(query: FranchiseQueryDto) {
    const page = parseInt((query.page || "1") as string);
    const limit = parseInt((query.limit || "20") as string);
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.search) where.OR = [{ name: { contains: query.search, mode: "insensitive" } }, { address: { contains: query.search, mode: "insensitive" } }];
    if (query.status) where.status = query.status;

    const [rows, total] = await Promise.all([
      db.franchise.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.franchise.count({ where }),
    ]);

    const items = rows.map((f: any) => ({
      id: f.id,
      franchiseName: f.name,
      contactPerson: f.contactPersonName,
      email: f.email,
      address: f.address,
      status: f.status,
    }));
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createFranchise(payload: CreateFranchiseDto) {
    const {
      franchiseName,
      state,
      address,
      contactPersonName,
      email,
      phoneNumber,
      altPhoneNumber,
    } = payload || {};
    if (!franchiseName || !state || !address || !contactPersonName || !email || !phoneNumber) {
      throw new ValidationError("franchiseName, state, address, contactPersonName, email, phoneNumber are required");
    }
    const created = await db.franchise.create({
      data: {
        name: franchiseName,
        state,
        address,
        contactPersonName,
        email,
        phoneNumber,
        altPhoneNumber,
        status: "PENDING",
        isActive: true,
      },
    });
    return created;
  }

  async updateFranchise(id: string, payload: UpdateFranchiseDto) {
    if (!id) {
      throw new ValidationError("id is required");
    }
    const franchise = await db.franchise.findUnique({ where: { id } });
    if (!franchise) {
      throw new NotFoundError("Franchise not found");
    }

    const patch: any = {};
    if (typeof payload.franchiseName === "string" && payload.franchiseName.trim()) {
      patch.name = payload.franchiseName.trim();
    }
    if (typeof payload.state === "string" && payload.state.trim()) patch.state = payload.state.trim();
    if (typeof payload.address === "string" && payload.address.trim()) patch.address = payload.address.trim();
    if (typeof payload.contactPersonName === "string" && payload.contactPersonName.trim()) {
      patch.contactPersonName = payload.contactPersonName.trim();
    }
    if (typeof payload.email === "string" && payload.email.trim()) patch.email = payload.email.trim();
    if (typeof payload.phoneNumber === "string" && payload.phoneNumber.trim()) patch.phoneNumber = payload.phoneNumber.trim();
    if (typeof payload.altPhoneNumber === "string") {
      patch.altPhoneNumber = payload.altPhoneNumber.trim() || null;
    } else if (payload.altPhoneNumber === null) {
      patch.altPhoneNumber = null;
    }

    if (Object.keys(patch).length === 0) {
      throw new ValidationError("No update fields provided");
    }

    const updated = await db.franchise.update({
      where: { id },
      data: patch,
    });
    return updated;
  }

  async updateFranchiseStatus(id: string, status: string) {
    const updated = await db.franchise.update({
      where: { id },
      data: { status, isActive: status === "Active" },
    });
    return updated;
  }

  async approveFranchise(id: string) {
    const updated = await db.franchise.update({
      where: { id },
      data: { status: "Active", isActive: true },
    });
    return updated;
  }

  async getFranchise(id: string) {
    if (!id) {
      throw new ValidationError("id is required");
    }
    const franchise = await db.franchise.findUnique({ where: { id } });
    if (!franchise) {
      throw new NotFoundError("Franchise not found");
    }

    const [totalBranches, activeBranches, deactivatedBranches, pendingBranches] = await Promise.all([
      db.branch.count({ where: { franchiseId: id } }),
      db.branch.count({ where: { franchiseId: id, status: "Active" } }),
      db.branch.count({ where: { franchiseId: id, status: "Deactivated" } }),
      db.branch.count({ where: { franchiseId: id, status: "PENDING" } }),
    ]);

    return {
      id: franchise.id,
      franchiseName: franchise.name,
      contactPerson: franchise.contactPersonName,
      email: franchise.email,
      phoneNumber: franchise.phoneNumber,
      altPhoneNumber: franchise.altPhoneNumber,
      state: franchise.state,
      address: franchise.address,
      status: franchise.status,
      isActive: franchise.isActive,
      createdAt: franchise.createdAt,
      updatedAt: franchise.updatedAt,
      branchStats: {
        total: totalBranches,
        active: activeBranches,
        deactivated: deactivatedBranches,
        pending: pendingBranches,
      },
    };
  }

  async exportFranchises(filters: { search?: string; status?: string } = {}) {
    const where: any = {};
    const search = (filters.search || "").toString().trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { contactPersonName: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }
    if (filters.status) where.status = filters.status;
    const rows = await db.franchise.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10_000,
      select: {
        id: true,
        name: true,
        contactPersonName: true,
        email: true,
        phoneNumber: true,
        address: true,
        status: true,
      },
    });
    return (rows || []).map((f: any) => ({
      franchiseName: f.name,
      franchiseId: f.id,
      contactPerson: f.contactPersonName,
      contactEmail: f.email,
      contactPhone: f.phoneNumber,
      address: f.address,
      status: f.status,
    }));
  }

  async getBranchStats() {
    const total = await db.branch.count();
    const active = await db.branch.count({ where: { status: "Active" } });
    const deactivated = await db.branch.count({ where: { status: "Deactivated" } });
    return { total, active, deactivated };
  }

  async listBranches(query: any) {
    const page = parseInt((query.page || "1") as string);
    const limit = parseInt((query.limit || "20") as string);
    const skip = (page - 1) * limit;
    const where: any = {};
    if (query.search) where.OR = [{ name: { contains: query.search, mode: "insensitive" } }, { address: { contains: query.search, mode: "insensitive" } }];
    if (query.status) where.status = query.status;

    const [rows, total] = await Promise.all([
      db.branch.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      db.branch.count({ where }),
    ]);

    const items = rows.map((b: any) => ({
      id: b.id,
      branchName: b.name,
      branchManager: b.branchManager,
      email: b.email,
      address: b.address,
      status: b.status,
    }));
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listBranchesAll(search?: string) {
    const where: any = {};
    const q = (search || "").toString().trim();
    if (q.length > 0) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
      ];
    }
    const rows = await db.branch.findMany({
      where,
      orderBy: { name: "asc" },
      take: 10_000,
      select: { id: true, name: true },
    });
    const items = rows.map((b: any) => ({ id: b.id, name: b.name }));
    items.sort((a: any, b: any) => (a.name || "").localeCompare(b.name || "", undefined, { sensitivity: "base" }));
    return items;
  }

  async listBranchesByFranchise(franchiseId: string, query: any, page = 1, limit = 20) {
    if (!franchiseId) {
      throw new ValidationError("franchiseId is required");
    }
    const franchise = await db.franchise.findUnique({ where: { id: franchiseId }, select: { id: true } });
    if (!franchise) {
      throw new NotFoundError("Franchise not found");
    }
    const skip = (page - 1) * limit;
    const where: any = { franchiseId };
    const q = ((query?.search as string) || "").toString().trim();
    if (q.length > 0) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
      ];
    }
    if (query?.status) where.status = query.status;

    const [rows, total] = await Promise.all([
      db.branch.findMany({ where, orderBy: { createdAt: "desc" }, skip, take: limit }),
      db.branch.count({ where }),
    ]);

    const items = (rows || []).map((b: any) => ({
      id: b.id,
      branchName: b.name,
      branchManager: b.branchManager,
      email: b.email,
      address: b.address,
      status: b.status,
    }));
    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async listBranchesByFranchiseAll(franchiseId: string, query: any) {
    if (!franchiseId) {
      throw new ValidationError("franchiseId is required");
    }
    const franchise = await db.franchise.findUnique({ where: { id: franchiseId }, select: { id: true } });
    if (!franchise) {
      throw new NotFoundError("Franchise not found");
    }
    const where: any = { franchiseId };
    const q = ((query?.search as string) || "").toString().trim();
    if (q.length > 0) {
      where.OR = [
        { name: { contains: q, mode: "insensitive" } },
        { address: { contains: q, mode: "insensitive" } },
      ];
    }
    if (query?.status) where.status = query.status;

    const rows = await db.branch.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: 10_000,
    });

    return (rows || []).map((b: any) => ({
      id: b.id,
      branchName: b.name,
      branchManager: b.branchManager,
      email: b.email,
      address: b.address,
      status: b.status,
    }));
  }

  async listTransactionsByFranchise(franchiseId: string, filters: any, page = 1, limit = 20) {
    if (!franchiseId) {
      throw new ValidationError("franchiseId is required");
    }
    const franchise = await db.franchise.findUnique({ where: { id: franchiseId }, select: { id: true } });
    if (!franchise) {
      throw new NotFoundError("Franchise not found");
    }

    const skip = (page - 1) * limit;
    const where: any = {
      createdByAgent: {
        is: {
          branch: {
            is: { franchiseId },
          },
        },
      },
    };

    if (filters?.status) where.status = filters.status;
    if (filters?.step) where.currentStep = filters.step;

    const rawType = (filters?.type || "").toString().trim().toLowerCase();
    if (rawType === "buyfx") {
      where.transactionMode = "BUY" as any;
    } else if (rawType === "sellfx") {
      where.transactionMode = "SELL" as any;
    } else if (rawType) {
      where.type = (filters.type as string).toUpperCase();
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters?.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters?.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const search = (filters?.search || "").toString().trim();
    if (search) {
      const matchedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search, mode: "insensitive" } },
            { profile: { firstName: { contains: search, mode: "insensitive" } } },
            { profile: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        },
        select: { id: true },
      });
      const userIds = matchedUsers.map((u) => u.id);
      where.OR = [
        { referenceNumber: { contains: search, mode: "insensitive" } },
        ...(userIds.length ? [{ userId: { in: userIds } }] : []),
      ];
    }

    const orderBy: any = {};
    const sortBy = filters?.sortBy || "createdAt";
    const sortOrder = (filters?.sortOrder || "desc").toString().toLowerCase() === "asc" ? "asc" : "desc";
    orderBy[sortBy] = sortOrder;

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    const uniqueUserIds = Array.from(new Set(items.map((t: any) => t.userId)));
    const users = uniqueUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: { id: true, profile: { select: { firstName: true, lastName: true } } },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = items.map((t: any) => {
      const u: any = userMap.get(t.userId);
      const name =
        u && u.profile ? `${u.profile.firstName || ""} ${u.profile.lastName || ""}`.trim() : undefined;
      const value = Number(t.nairaEquivalent || t.foreignAmount || 0);
      return {
        id: t.id,
        customerName: name,
        dateAndId: { date: t.createdAt, reference: t.referenceNumber },
        transactionType: t.type,
        transactionStage: t.currentStep,
        workflowStage: t.status,
        transactionValue: value,
        status: t.status,
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async listTransactionsByBranch(branchId: string, filters: any, page = 1, limit = 20) {
    if (!branchId) {
      throw new ValidationError("branchId is required");
    }
    const branch = await db.branch.findUnique({ where: { id: branchId }, select: { id: true } });
    if (!branch) {
      throw new NotFoundError("Branch not found");
    }

    const skip = (page - 1) * limit;
    const where: any = {
      createdByAgent: {
        is: { branchId },
      },
    };

    if (filters?.status) where.status = filters.status;
    if (filters?.step) where.currentStep = filters.step;

    const rawType = (filters?.type || "").toString().trim().toLowerCase();
    if (rawType === "buyfx") {
      where.transactionMode = "BUY" as any;
    } else if (rawType === "sellfx") {
      where.transactionMode = "SELL" as any;
    } else if (rawType) {
      where.type = (filters.type as string).toUpperCase();
    }

    if (filters?.dateFrom || filters?.dateTo) {
      where.createdAt = {};
      if (filters?.dateFrom) where.createdAt.gte = new Date(filters.dateFrom);
      if (filters?.dateTo) where.createdAt.lte = new Date(filters.dateTo);
    }

    const search = (filters?.search || "").toString().trim();
    if (search) {
      const matchedUsers = await prisma.user.findMany({
        where: {
          OR: [
            { email: { contains: search, mode: "insensitive" } },
            { phoneNumber: { contains: search, mode: "insensitive" } },
            { profile: { firstName: { contains: search, mode: "insensitive" } } },
            { profile: { lastName: { contains: search, mode: "insensitive" } } },
          ],
        },
        select: { id: true },
      });
      const userIds = matchedUsers.map((u) => u.id);
      where.OR = [
        { referenceNumber: { contains: search, mode: "insensitive" } },
        ...(userIds.length ? [{ userId: { in: userIds } }] : []),
      ];
    }

    const orderBy: any = {};
    const sortBy = filters?.sortBy || "createdAt";
    const sortOrder = (filters?.sortOrder || "desc").toString().toLowerCase() === "asc" ? "asc" : "desc";
    orderBy[sortBy] = sortOrder;

    const [items, total] = await Promise.all([
      prisma.transaction.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      prisma.transaction.count({ where }),
    ]);

    const uniqueUserIds = Array.from(new Set(items.map((t: any) => t.userId)));
    const users = uniqueUserIds.length
      ? await prisma.user.findMany({
          where: { id: { in: uniqueUserIds } },
          select: { id: true, profile: { select: { firstName: true, lastName: true } } },
        })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u]));

    const data = items.map((t: any) => {
      const u: any = userMap.get(t.userId);
      const name =
        u && u.profile ? `${u.profile.firstName || ""} ${u.profile.lastName || ""}`.trim() : undefined;
      const value = Number(t.nairaEquivalent || t.foreignAmount || 0);
      return {
        id: t.id,
        customerName: name,
        dateAndId: { date: t.createdAt, reference: t.referenceNumber },
        transactionType: t.type,
        transactionStage: t.currentStep,
        workflowStage: t.status,
        transactionValue: value,
        status: t.status,
      };
    });

    return {
      data,
      meta: { page, limit, total, totalPages: Math.ceil(total / limit) },
    };
  }

  async createBranch(payload: CreateBranchDto) {
    const { branchName, branchEmail, state, address, branchManager, email, phoneNumber, agentName, agentEmail, agentPhoneNumber, franchiseId } = payload || {};
    if (!branchName || !state || !address || !branchManager || !email || !phoneNumber) {
      throw new ValidationError("branchName, state, address, branchManager, email, phoneNumber are required");
    }
    const existingByName = await db.branch.findFirst({
      where: { name: { equals: branchName, mode: "insensitive" } },
      select: { id: true },
    });
    if (existingByName) {
      throw new ValidationError("Branch name already exists", { field: "branchName" });
    }
    if (branchEmail) {
      const existingByEmail = await db.branch.findFirst({
        where: { branchEmail: { equals: branchEmail, mode: "insensitive" } },
        select: { id: true },
      });
      if (existingByEmail) {
        throw new ValidationError("Branch email already exists", { field: "branchEmail" });
      }
    }
    const created = await db.branch.create({
      data: {
        franchiseId,
        name: branchName,
        branchEmail,
        state,
        address,
        branchManager,
        email,
        phoneNumber,
        agentName,
        agentEmail,
        agentPhoneNumber,
        status: "PENDING",
        isActive: true,
      },
    });
    return created;
  }

  async getBranch(id: string) {
    const branch = await db.branch.findUnique({ where: { id } });
    if (!branch) return null;
    return branch;
  }

  async updateBranch(
    id: string,
    payload: Partial<CreateBranchDto> & { status?: string; isActive?: boolean }
  ) {
    if (!id) {
      throw new ValidationError("branchId is required");
    }
    const branch = await db.branch.findUnique({ where: { id } });
    if (!branch) {
      throw new NotFoundError("Branch not found");
    }

    const patch: any = {};
    const branchName = typeof payload.branchName === "string" ? payload.branchName.trim() : "";
    const branchEmail = typeof payload.branchEmail === "string" ? payload.branchEmail.trim() : "";

    if (branchName && branchName.toLowerCase() !== (branch.name || "").toLowerCase()) {
      const existingByName = await db.branch.findFirst({
        where: { name: { equals: branchName, mode: "insensitive" }, NOT: { id } },
        select: { id: true },
      });
      if (existingByName) {
        throw new ValidationError("Branch name already exists", { field: "branchName" });
      }
      patch.name = branchName;
    }

    if (branchEmail) {
      const existingByEmail = await db.branch.findFirst({
        where: { branchEmail: { equals: branchEmail, mode: "insensitive" }, NOT: { id } },
        select: { id: true },
      });
      if (existingByEmail) {
        throw new ValidationError("Branch email already exists", { field: "branchEmail" });
      }
      patch.branchEmail = branchEmail;
    } else if (payload.branchEmail === null) {
      patch.branchEmail = null;
    }

    if (typeof payload.state === "string" && payload.state.trim()) patch.state = payload.state.trim();
    if (typeof payload.address === "string" && payload.address.trim()) patch.address = payload.address.trim();
    if (typeof payload.branchManager === "string" && payload.branchManager.trim()) patch.branchManager = payload.branchManager.trim();
    if (typeof payload.email === "string" && payload.email.trim()) patch.email = payload.email.trim();
    if (typeof payload.phoneNumber === "string" && payload.phoneNumber.trim()) patch.phoneNumber = payload.phoneNumber.trim();
    if (typeof payload.agentName === "string") patch.agentName = payload.agentName.trim() || null;
    if (typeof payload.agentEmail === "string") patch.agentEmail = payload.agentEmail.trim() || null;
    if (typeof payload.agentPhoneNumber === "string") patch.agentPhoneNumber = payload.agentPhoneNumber.trim() || null;

    if (typeof payload.franchiseId === "string" && payload.franchiseId.trim()) {
      const franchise = await db.franchise.findUnique({ where: { id: payload.franchiseId.trim() }, select: { id: true } });
      if (!franchise) {
        throw new NotFoundError("Franchise not found");
      }
      patch.franchiseId = payload.franchiseId.trim();
    } else if (payload.franchiseId === null) {
      patch.franchiseId = null;
    }

    if (Object.keys(patch).length === 0) {
      throw new ValidationError("No update fields provided");
    }

    const updated = await db.branch.update({
      where: { id },
      data: patch,
    });
    return updated;
  }

  async updateBranchStatus(id: string, status: string) {
    const updated = await db.branch.update({
      where: { id },
      data: { status, isActive: status === "Active" },
    });
    return updated;
  }

  async listPickupStations(query: PickupStationQueryDto) {
    const page = parseInt((query.page || "1") as any);
    const limit = parseInt((query.limit || "20") as any);
    const skip = (page - 1) * limit;
    const where: any = {};

    const search = (query.search || "").toString().trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { address: { contains: search, mode: "insensitive" } },
        { region: { contains: search, mode: "insensitive" } },
        { state: { contains: search, mode: "insensitive" } },
      ];
    }
    if (query.state) where.state = { equals: query.state, mode: "insensitive" };
    if (query.region) where.region = { equals: query.region, mode: "insensitive" };
    if (query.status) where.status = query.status;

    const [rows, total] = await Promise.all([
      db.pickupStation.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip,
        take: limit,
      }),
      db.pickupStation.count({ where }),
    ]);

    const items = (rows || []).map((s: any) => ({
      id: s.id,
      stationName: s.name,
      stationEmail: s.email,
      phoneNumber: s.phoneNumber,
      state: s.state,
      region: s.region,
      physicalAddress: s.address,
      status: s.status,
      isActive: s.isActive,
      createdAt: s.createdAt,
      updatedAt: s.updatedAt,
    }));

    return { items, pagination: { page, limit, total, totalPages: Math.ceil(total / limit) } };
  }

  async createPickupStation(payload: CreatePickupStationDto) {
    const { stationName, stationEmail, phoneNumber, state, region, physicalAddress, status } = payload || ({} as any);
    if (!stationName || !stationEmail || !phoneNumber || !state || !region || !physicalAddress) {
      throw new ValidationError("stationName, stationEmail, phoneNumber, state, region, physicalAddress are required");
    }

    const existingByName = await db.pickupStation.findFirst({
      where: { name: { equals: stationName.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (existingByName) {
      throw new ValidationError("Station name already exists", { field: "stationName" });
    }

    const existingByEmail = await db.pickupStation.findFirst({
      where: { email: { equals: stationEmail.trim(), mode: "insensitive" } },
      select: { id: true },
    });
    if (existingByEmail) {
      throw new ValidationError("Station email already exists", { field: "stationEmail" });
    }

    const created = await db.pickupStation.create({
      data: {
        name: stationName.trim(),
        email: stationEmail.trim(),
        phoneNumber: phoneNumber.trim(),
        state: state.trim(),
        region: region.trim(),
        address: physicalAddress.trim(),
        status: status || "PENDING",
        isActive: true,
      },
    });

    return created;
  }

  async getPickupStation(id: string) {
    if (!id) {
      throw new ValidationError("id is required");
    }
    const station = await db.pickupStation.findUnique({ where: { id } });
    if (!station) {
      throw new NotFoundError("Pick-up station not found");
    }
    return station;
  }

  async updatePickupStation(id: string, payload: UpdatePickupStationDto) {
    if (!id) {
      throw new ValidationError("id is required");
    }
    const station = await db.pickupStation.findUnique({ where: { id } });
    if (!station) {
      throw new NotFoundError("Pick-up station not found");
    }

    const patch: any = {};

    const stationName = typeof payload.stationName === "string" ? payload.stationName.trim() : "";
    if (stationName && stationName.toLowerCase() !== (station.name || "").toLowerCase()) {
      const existingByName = await db.pickupStation.findFirst({
        where: { name: { equals: stationName, mode: "insensitive" }, NOT: { id } },
        select: { id: true },
      });
      if (existingByName) {
        throw new ValidationError("Station name already exists", { field: "stationName" });
      }
      patch.name = stationName;
    }

    const stationEmail = typeof payload.stationEmail === "string" ? payload.stationEmail.trim() : "";
    if (stationEmail && stationEmail.toLowerCase() !== (station.email || "").toLowerCase()) {
      const existingByEmail = await db.pickupStation.findFirst({
        where: { email: { equals: stationEmail, mode: "insensitive" }, NOT: { id } },
        select: { id: true },
      });
      if (existingByEmail) {
        throw new ValidationError("Station email already exists", { field: "stationEmail" });
      }
      patch.email = stationEmail;
    }

    if (typeof payload.phoneNumber === "string" && payload.phoneNumber.trim()) patch.phoneNumber = payload.phoneNumber.trim();
    if (typeof payload.state === "string" && payload.state.trim()) patch.state = payload.state.trim();
    if (typeof payload.region === "string" && payload.region.trim()) patch.region = payload.region.trim();
    if (typeof payload.physicalAddress === "string" && payload.physicalAddress.trim()) patch.address = payload.physicalAddress.trim();
    if (typeof payload.status === "string" && payload.status.trim()) patch.status = payload.status.trim();
    if (typeof payload.isActive === "boolean") patch.isActive = payload.isActive;

    if (Object.keys(patch).length === 0) {
      throw new ValidationError("No update fields provided");
    }

    const updated = await db.pickupStation.update({
      where: { id },
      data: patch,
    });
    return updated;
  }

  async deletePickupStation(id: string) {
    if (!id) {
      throw new ValidationError("id is required");
    }
    const station = await db.pickupStation.findUnique({ where: { id }, select: { id: true } });
    if (!station) {
      throw new NotFoundError("Pick-up station not found");
    }
    await db.pickupStation.delete({ where: { id } });
    return { id };
  }

  // async exportBranches() {
  //   return { message: "Export generated", url: "/exports/branches.csv" };
  // }

  async addAgentsToBranch(id: string, agentIds: string[]) {
    return { message: "Agents added", branchId: id, count: agentIds?.length || 0 };
  }

  async listNigeriaStates() {
    const states = [
      "Abia",
      "Adamawa",
      "Akwa Ibom",
      "Anambra",
      "Bauchi",
      "Bayelsa",
      "Benue",
      "Borno",
      "Cross River",
      "Delta",
      "Ebonyi",
      "Edo",
      "Ekiti",
      "Enugu",
      "Gombe",
      "Imo",
      "Jigawa",
      "Kaduna",
      "Kano",
      "Katsina",
      "Kebbi",
      "Kogi",
      "Kwara",
      "Lagos",
      "Nasarawa",
      "Niger",
      "Ogun",
      "Ondo",
      "Osun",
      "Oyo",
      "Plateau",
      "Rivers",
      "Sokoto",
      "Taraba",
      "Yobe",
      "Zamfara",
      "Abuja",
    ];
    return states.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  }
}

export const outletService = new OutletService();
