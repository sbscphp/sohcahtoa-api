import { getDatabase } from "../../../config/database";
import { createLogger, ValidationError } from "../../../shared/utils";
import { ServiceName } from "../../../shared/types";
import { CreateFranchiseDto, FranchiseQueryDto, CreateBranchDto } from "../dto/outlet.dto";

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

  async exportFranchises() {
    return { message: "Export generated", url: "/exports/franchises.csv" };
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

  async updateBranchStatus(id: string, status: string) {
    const updated = await db.branch.update({
      where: { id },
      data: { status, isActive: status === "Active" },
    });
    return updated;
  }

  // async exportBranches() {
  //   return { message: "Export generated", url: "/exports/branches.csv" };
  // }

  async addAgentsToBranch(id: string, agentIds: string[]) {
    return { message: "Agents added", branchId: id, count: agentIds?.length || 0 };
  }
}

export const outletService = new OutletService();
