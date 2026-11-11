import { getDatabase } from "../../../config/database";
import { NotFoundError, ValidationError } from "../../../shared/utils";
import { fxInventoryService } from "./fx-inventory.service";

const prisma: any = getDatabase();

// Mirrors the BUY/SELL grouping used by admin-transactions.service.ts.
// "Buy" = customer buys FX from the agent (agent SELLS); "Sell" = customer sells FX to the agent (agent PURCHASES).
const BUY_GROUP_TYPES = ["PTA", "BTA", "SCHOOL_FEES", "MEDICAL", "PROFESSIONAL_BODY"];
const SELL_GROUP_TYPES = ["RESIDENT_FX", "EXPATRIATE_FX"];

type Flow = { disbursed: number; purchased: number; sold: number; lodged: number };
type Range = { from: Date; to: Date };

const emptyFlow = (): Flow => ({ disbursed: 0, purchased: 0, sold: 0, lodged: 0 });
const round2 = (n: number) => Math.round(n * 100) / 100;

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function endOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

/** Accepts dateFrom/dateTo (ISO) or date=today|YYYY-MM-DD. Defaults to today. */
export function resolveRange(f: { date?: string; dateFrom?: string; dateTo?: string } = {}): Range {
  if (f.dateFrom || f.dateTo) {
    const from = f.dateFrom ? new Date(f.dateFrom) : new Date(0);
    const to = f.dateTo ? new Date(f.dateTo) : new Date();
    if (isNaN(from.getTime()) || isNaN(to.getTime())) throw new ValidationError("Invalid dateFrom/dateTo");
    return { from, to };
  }
  const day = !f.date || f.date.toLowerCase() === "today" ? new Date() : new Date(f.date);
  if (isNaN(day.getTime())) throw new ValidationError("Invalid date");
  return { from: startOfDay(day), to: endOfDay(day) };
}

class FxInventoryAgentService {
  // ── Agents list (Outlet Management → Agent FX Inventory) ──────────────────

  async listAgents(filters: { search?: string; branchId?: string; page?: number; limit?: number; all?: boolean } = {}) {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.max(1, Math.min(100, filters.limit || 20));
    const where: any = {};
    if (filters.branchId) where.branchId = filters.branchId;
    const search = filters.search?.trim();
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { phoneNumber: { contains: search, mode: "insensitive" } },
      ];
    }

    const [agents, total] = await Promise.all([
      prisma.agent.findMany({
        where,
        orderBy: { name: "asc" },
        ...(filters.all ? { take: 10_000 } : { skip: (page - 1) * limit, take: limit }),
        select: { id: true, name: true, email: true, phoneNumber: true, isActive: true, branch: { select: { id: true, name: true } } },
      }),
      prisma.agent.count({ where }),
    ]);

    const ids = agents.map((a: any) => a.id);
    const [disb, lodg] = ids.length
      ? await Promise.all([
          prisma.cashDisbursement.groupBy({ by: ["agentId"], where: { agentId: { in: ids } }, _count: { _all: true } }),
          prisma.cashLodgment.groupBy({ by: ["agentId"], where: { agentId: { in: ids } }, _count: { _all: true } }),
        ])
      : [[], []];
    const disbMap = new Map<string, number>(disb.map((g: any) => [g.agentId, g._count._all]));
    const lodgMap = new Map<string, number>(lodg.map((g: any) => [g.agentId, g._count._all]));

    return {
      data: agents.map((a: any) => ({
        agentId: a.id,
        name: a.name,
        email: a.email,
        phoneNumber: a.phoneNumber,
        isActive: a.isActive,
        branchId: a.branch?.id ?? null,
        branchName: a.branch?.name ?? null,
        totalDisbursements: disbMap.get(a.id) ?? 0,
        totalLodgments: lodgMap.get(a.id) ?? 0,
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) || 1 },
    };
  }

  // ── Flow aggregation (source of truth for position + overview) ────────────

  private classify(type: string, mode?: string | null): "sold" | "purchased" | null {
    if (mode === "BUY") return "sold";
    if (mode === "SELL") return "purchased";
    if (BUY_GROUP_TYPES.includes(type)) return "sold";
    if (SELL_GROUP_TYPES.includes(type)) return "purchased";
    return null;
  }

  /**
   * Per-currency flows for an agent within (from, to]. Pass from=undefined for "everything before `to`".
   * Disbursed counts only once the agent confirmed receipt; lodged only once admin confirmed.
   */
  private async getFlows(agentId: string, range: { from?: Date; to: Date; toExclusive?: boolean }) {
    const cmp = (field: string) => {
      const c: any = {};
      if (range.from) c.gte = range.from;
      c[range.toExclusive ? "lt" : "lte"] = range.to;
      return { [field]: c };
    };

    const [disb, lodg, txs] = await Promise.all([
      prisma.cashDisbursement.groupBy({
        by: ["currency"],
        where: { agentId, status: "COMPLETED", ...cmp("receiptConfirmedAt") },
        _sum: { amount: true },
      }),
      prisma.cashLodgment.groupBy({
        by: ["currency"],
        where: { agentId, status: "CONFIRMED", ...cmp("confirmedAt") },
        _sum: { confirmedAmount: true },
      }),
      prisma.transaction.groupBy({
        by: ["currency", "type", "transactionMode"],
        where: { createdByAgentId: agentId, status: "COMPLETED", ...cmp("completedAt") },
        _sum: { foreignAmount: true, nairaEquivalent: true },
      }),
    ]);

    const flows = new Map<string, Flow>();
    const get = (c: string) => {
      const k = c.toUpperCase();
      if (!flows.has(k)) flows.set(k, emptyFlow());
      return flows.get(k)!;
    };
    const ngn = { disbursed: 0, purchased: 0, sold: 0, lodged: 0 }; // NGN legs of customer deals handled below

    for (const g of disb) get(g.currency).disbursed += Number(g._sum.amount || 0);
    for (const g of lodg) get(g.currency).lodged += Number(g._sum.confirmedAmount || 0);
    for (const g of txs) {
      const side = this.classify(g.type, g.transactionMode);
      if (!side) continue;
      get(g.currency)[side] += Number(g._sum.foreignAmount || 0);
      // NGN leg: agent receives naira when it sells FX, pays naira when it purchases FX
      ngn[side] += Number(g._sum.nairaEquivalent || 0);
    }
    return { flows, ngn };
  }

  private closing(opening: number, f: Flow) {
    return round2(opening + f.disbursed + f.purchased - f.sold - f.lodged);
  }

  private async rateFor(currency: string): Promise<number | null> {
    try {
      return await fxInventoryService.convertToNgn(currency, 1);
    } catch {
      return null;
    }
  }

  // ── Inventory Position tab ────────────────────────────────────────────────

  async getInventoryPosition(agentId: string, filters: { date?: string; dateFrom?: string; dateTo?: string; currency?: string } = {}) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { id: true, name: true } });
    if (!agent) throw new NotFoundError("Agent not found");

    const range = resolveRange(filters);
    const [before, during, counts, balances] = await Promise.all([
      this.getFlows(agentId, { to: range.from, toExclusive: true }),
      this.getFlows(agentId, { from: range.from, to: range.to }),
      prisma.agentPhysicalCount.findMany({
        where: { agentId, countDate: { gte: range.from, lte: range.to } },
        orderBy: { countDate: "desc" },
      }),
      prisma.agentCashBalance.findMany({ where: { agentId }, select: { currency: true } }),
    ]);

    const currencies = new Set<string>([
      ...before.flows.keys(),
      ...during.flows.keys(),
      ...balances.map((b: any) => String(b.currency).toUpperCase()),
    ]);
    currencies.delete("NGN");
    if (filters.currency) {
      const only = filters.currency.toUpperCase();
      for (const c of [...currencies]) if (c !== only) currencies.delete(c);
    }

    const latestCount = new Map<string, number>();
    for (const c of counts) {
      const k = String(c.currency).toUpperCase();
      if (!latestCount.has(k)) latestCount.set(k, Number(c.countedAmount));
    }

    const total = { openingBalance: 0, disbursed: 0, purchased: 0, sold: 0, lodged: 0, closingBalance: 0, physicalCount: 0, variance: 0 };
    let anyCount = false;

    const rows = [];
    for (const currency of [...currencies].sort()) {
      const b = before.flows.get(currency) ?? emptyFlow();
      const f = during.flows.get(currency) ?? emptyFlow();
      const openingBalance = this.closing(0, b);
      const closingBalance = this.closing(openingBalance, f);
      const physicalCount = latestCount.get(currency) ?? null;
      const variance = physicalCount != null ? round2(physicalCount - closingBalance) : null;

      rows.push({
        currency,
        openingBalance,
        disbursedFromAdmin: round2(f.disbursed),
        purchasedFromCustomers: round2(f.purchased),
        soldToCustomers: round2(f.sold),
        lodgedToHq: round2(f.lodged),
        closingBalance,
        physicalCount,
        variance,
      });

      const rate = await this.rateFor(currency);
      if (rate != null) {
        total.openingBalance += openingBalance * rate;
        total.disbursed += f.disbursed * rate;
        total.purchased += f.purchased * rate;
        total.sold += f.sold * rate;
        total.lodged += f.lodged * rate;
        total.closingBalance += closingBalance * rate;
        if (physicalCount != null) {
          anyCount = true;
          total.physicalCount += physicalCount * rate;
          total.variance += (physicalCount - closingBalance) * rate;
        }
      }
    }

    return {
      agentId,
      agentName: agent.name,
      period: { from: range.from, to: range.to },
      rows,
      total: {
        currency: "NGN",
        openingBalance: round2(total.openingBalance),
        disbursedFromAdmin: round2(total.disbursed),
        purchasedFromCustomers: round2(total.purchased),
        soldToCustomers: round2(total.sold),
        lodgedToHq: round2(total.lodged),
        closingBalance: round2(total.closingBalance),
        physicalCount: anyCount ? round2(total.physicalCount) : null,
        variance: anyCount ? round2(total.variance) : null,
      },
    };
  }

  // ── Overview cards (shared by Inventory Position + Cash Lodgment tabs) ────

  async getAgentOverview(agentId: string, filters: { currency?: string; date?: string; dateFrom?: string; dateTo?: string } = {}) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { id: true, name: true } });
    if (!agent) throw new NotFoundError("Agent not found");

    const currency = (filters.currency || "USD").toUpperCase();
    const range = resolveRange(filters);

    // Cumulative position up to the end of the selected period
    const upTo = await this.getFlows(agentId, { to: range.to });
    const fx = upTo.flows.get(currency) ?? emptyFlow();
    const availableFxInventory = this.closing(0, fx);

    const ngnFlow = upTo.flows.get("NGN") ?? emptyFlow();
    const ngnCashAvailable = round2(ngnFlow.disbursed + ngnFlow.lodged * -1 + upTo.ngn.sold - upTo.ngn.purchased);

    const [pendingSettlements, lodgedInPeriod] = await Promise.all([
      prisma.transaction.count({
        where: {
          createdByAgentId: agentId,
          currency,
          settlement: { is: { status: { in: ["PENDING", "AWAITING_CONFIRMATION"] } } },
        },
      }),
      prisma.cashLodgment.groupBy({
        by: ["currency"],
        where: { agentId, status: "CONFIRMED", confirmedAt: { gte: range.from, lte: range.to } },
        _sum: { confirmedAmount: true },
      }),
    ]);

    let cashLodgement = 0;
    for (const g of lodgedInPeriod) {
      const amt = Number(g._sum.confirmedAmount || 0);
      const rate = g.currency.toUpperCase() === "NGN" ? 1 : await this.rateFor(g.currency);
      if (rate != null) cashLodgement += amt * rate;
    }

    return {
      agentId,
      agentName: agent.name,
      currency,
      period: { from: range.from, to: range.to },
      availableFxInventory,
      ngnCashAvailable,
      pendingSettlements,
      cashLodgement: round2(cashLodgement),
    };
  }

  // ── Physical count (feeds Physical Count / Variance columns) ──────────────

  async recordPhysicalCount(adminId: string, agentId: string, payload: { currency: string; countedAmount: number; countDate?: string; notes?: string }) {
    const agent = await prisma.agent.findUnique({ where: { id: agentId }, select: { id: true } });
    if (!agent) throw new NotFoundError("Agent not found");

    const currency = payload.currency?.trim().toUpperCase();
    const countedAmount = Number(payload.countedAmount);
    if (!currency) throw new ValidationError("currency is required");
    if (isNaN(countedAmount) || countedAmount < 0) throw new ValidationError("countedAmount must be a non-negative number");
    const countDate = payload.countDate ? new Date(payload.countDate) : new Date();
    if (isNaN(countDate.getTime())) throw new ValidationError("Invalid countDate");

    const row = await prisma.agentPhysicalCount.create({
      data: { agentId, currency, countedAmount, countDate, countedBy: adminId, notes: payload.notes || null },
    });
    return { id: row.id, agentId, currency, countedAmount, countDate: row.countDate, notes: row.notes };
  }

  // ── Single lodgment (Cash Lodgment tab → row action) ──────────────────────

  async getLodgment(id: string) {
    const l = await prisma.cashLodgment.findUnique({
      where: { id },
      include: { agent: { select: { id: true, name: true, email: true } } },
    });
    if (!l) throw new NotFoundError("Cash lodgment not found");

    const adminIds = [l.confirmedBy, l.rejectedBy].filter(Boolean) as string[];
    const admins = adminIds.length
      ? await prisma.adminUser.findMany({ where: { id: { in: adminIds } }, select: { id: true, fullName: true } })
      : [];
    const name = (aid?: string | null) => admins.find((a: any) => a.id === aid)?.fullName ?? null;

    return {
      id: l.id,
      referenceNumber: l.referenceNumber,
      status: l.status,
      agent: l.agent,
      branchId: l.branchId,
      currency: l.currency,
      statedAmount: Number(l.statedAmount),
      confirmedAmount: l.confirmedAmount != null ? Number(l.confirmedAmount) : null,
      varianceAmount: l.varianceAmount != null ? Number(l.varianceAmount) : null,
      notes: l.notes,
      submittedAt: l.submittedAt,
      confirmedBy: l.confirmedBy,
      confirmedByName: name(l.confirmedBy),
      confirmedAt: l.confirmedAt,
      rejectedBy: l.rejectedBy,
      rejectedByName: name(l.rejectedBy),
      rejectedAt: l.rejectedAt,
      decisionReason: l.decisionReason,
    };
  }
}

export const fxInventoryAgentService = new FxInventoryAgentService();
export default fxInventoryAgentService;
