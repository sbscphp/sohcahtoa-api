import { NextFunction, Response } from "express";
import { AuthRequest } from "./auth";
import { ForbiddenError, UnauthorizedError } from "../utils/errors";
import { UserRole } from "../types";
import { getDatabase } from "../../config/database";
import { createLogger } from "../utils/logger";

const logger = createLogger("Permissions");

type Action = "view" | "edit" | "create" | "delete" | "export";

interface PermissionSpec {
  module: string;
  feature: string;
  action: Action | Action[];
}

export const MODULE_ALIASES: Record<string, string> = {
  TRANSACTION: "TRANSACTIONS",
  TRANSACTIONS: "TRANSACTIONS",

  CUSTOMER: "CUSTOMERS",
  CUSTOMERS: "CUSTOMERS",

  AGENT: "AGENTS",
  AGENTS: "AGENTS",

  SETTLEMENT: "SETTLEMENTS",
  SETTLEMENTS: "SETTLEMENTS",

  RATE: "RATES",
  RATES: "RATES",

  REPORT: "REPORTS",
  REPORTS: "REPORTS",

  AUDIT: "AUDIT",
  AUDITS: "AUDIT",
  AUDIT_TRAIL: "AUDIT",

  WALLET: "WALLET",
  WALLETS: "WALLET",
  TRANSIENT_WALLET: "WALLET",

  TICKET: "TICKETS",
  TICKETS: "TICKETS",
  INCIDENCE: "TICKETS",
  INCIDENCES: "TICKETS",

  OUTLET: "OUTLET",
  OUTLETS: "OUTLET",

  BRANCH: "BRANCH",
  BRANCHES: "BRANCH",

  PICKUP_STATION: "PICKUP_STATIONS",
  PICKUP_STATIONS: "PICKUP_STATIONS",

  COMPLIANCE: "COMPLIANCE",
  REGULATORY: "COMPLIANCE",
  COMPLIANCE_REVIEW: "COMPLIANCE",

  WORKFLOW: "WORKFLOW",
  WORKFLOWS: "WORKFLOW",

  DASHBOARD: "DASHBOARD",
  DASHBOARDS: "DASHBOARD",

  USER_MANAGEMENT: "USER_MANAGEMENT",
  USERS: "USER_MANAGEMENT",
  USER: "USER_MANAGEMENT",
};

export const FEATURE_ALIASES: Record<string, string> = {
  MODULE: "MODULE",
  MODULES: "MODULE",
  USER: "USERS",
  USERS: "USERS",
  ROLE: "ROLES",
  ROLES: "ROLES",
  DEPARTMENT: "DEPARTMENTS",
  DEPARTMENTS: "DEPARTMENTS",
};

export const normalizeModule = (s: string): string => {
  const norm = (s || "").toString().trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (MODULE_ALIASES[norm]) return MODULE_ALIASES[norm];
  if (norm.endsWith("S") && MODULE_ALIASES[norm.slice(0, -1)]) {
    return MODULE_ALIASES[norm.slice(0, -1)];
  }
  return norm;
};

export const normalizeFeature = (s: string): string => {
  const norm = (s || "").toString().trim().toUpperCase().replace(/[\s-]+/g, "_");
  if (FEATURE_ALIASES[norm]) return FEATURE_ALIASES[norm];
  if (norm.endsWith("S") && FEATURE_ALIASES[norm.slice(0, -1)]) {
    return FEATURE_ALIASES[norm.slice(0, -1)];
  }
  return norm;
};

const sanitizeAction = (a: string): Action | null => {
  const v = (a || "").toString().trim().toLowerCase().replace(/^can[ ._:-]?/g, "");
  const mapped = v === "update" ? "edit" : v;
  if (["view", "edit", "create", "delete", "export"].includes(mapped)) return mapped as Action;
  return null;
};

export const requirePermission =
  ({ module, feature, action }: PermissionSpec) =>
  async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return next(new UnauthorizedError("Authentication required"));
      }

      if (req.user.role === UserRole.SUPER_ADMIN || req.user.role === UserRole.ADMIN) {
        return next();
      }

      const prisma = getDatabase();
      const adminId = req.user.userId;

      const user = await prisma.adminUser.findUnique({
        where: { id: adminId },
        select: {
          id: true,
          permissions: true,
          role: {
            select: {
              id: true,
              name: true,
              permissions: true,
              rolePermissions: {
                select: {
                  permission: {
                    select: { module: true, featureKey: true, action: true, isActive: true },
                  },
                },
              },
            },
          },
        },
      });

      if (!user) {
        return next(new ForbiddenError("Insufficient permissions"));
      }

      if (user.role?.name === UserRole.SUPER_ADMIN || user.role?.name === UserRole.ADMIN) {
        return next();
      }

      const mod = normalizeModule(module);
      const feat = normalizeFeature(feature);
      const actions = Array.isArray(action) ? action : [action];
      const sanitized = actions
        .map((a) => sanitizeAction(a as string))
        .filter((a): a is Action => !!a);

      if (sanitized.length === 0) {
        return next(new ForbiddenError("Insufficient permissions"));
      }

      const allowed = new Set<string>();

      // 1. Process relational rolePermissions
      const perms = user.role?.rolePermissions || [];
      for (const rp of perms) {
        if (rp.permission?.isActive) {
          const m = normalizeModule(rp.permission.module || "");
          const f = normalizeFeature(rp.permission.featureKey || "");
          const a = sanitizeAction(rp.permission.action || "");
          if (m && f && a) {
            allowed.add(`${m}|${f}|${a}`);
          }
        }
      }

      // 2. Process JSON permissions from role and user if present
      const parseJsonPermissions = (raw: any) => {
        if (!raw) return;
        if (Array.isArray(raw)) {
          for (const item of raw) {
            if (typeof item === "string") {
              const parts = item.split(" - ").map((x) => x.trim());
              if (parts.length >= 3) {
                const m = normalizeModule(parts[0]);
                const f = normalizeFeature(parts[1]);
                const a = sanitizeAction(parts[2]);
                if (m && f && a) allowed.add(`${m}|${f}|${a}`);
              }
            } else if (typeof item === "object" && item !== null) {
              const m = normalizeModule(item.module || "");
              const f = normalizeFeature(item.featureKey || item.feature || "MODULE");
              const a = sanitizeAction(item.action || "");
              if (m && f && a) allowed.add(`${m}|${f}|${a}`);
            }
          }
        } else if (typeof raw === "object" && raw !== null) {
          for (const mKey of Object.keys(raw)) {
            const m = normalizeModule(mKey);
            const features = raw[mKey] || {};
            for (const fKey of Object.keys(features)) {
              const f = normalizeFeature(fKey);
              const actionList = Array.isArray(features[fKey]) ? features[fKey] : [features[fKey]];
              for (const act of actionList) {
                const a = sanitizeAction(act);
                if (m && f && a) allowed.add(`${m}|${f}|${a}`);
              }
            }
          }
        }
      };

      parseJsonPermissions((user.role as any)?.permissions);
      parseJsonPermissions((user as any)?.permissions);

      const ok = sanitized.some((a) => {
        return (
          allowed.has(`${mod}|${feat}|${a}`) ||
          allowed.has(`${mod}|MODULE|${a}`) ||
          allowed.has(`${mod}|*|${a}`)
        );
      });

      if (!ok) {
        logger.warn("Permission denied", {
          userId: adminId,
          module: mod,
          feature: feat,
          actions: sanitized,
        });
        return next(new ForbiddenError("Insufficient permissions"));
      }

      return next();
    } catch (err) {
      return next(new ForbiddenError("Insufficient permissions"));
    }
  };

