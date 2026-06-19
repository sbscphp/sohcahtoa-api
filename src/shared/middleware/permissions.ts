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
          role: {
            select: {
              id: true,
              name: true,
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

      const norm = (s: string) => s.toString().trim().toUpperCase().replace(/[\s-]+/g, "_");
      const mod = norm(module);
      const feat = norm(feature);
      const actions = Array.isArray(action) ? action : [action];
      const sanitized = actions
        .map((a) => sanitizeAction(a as string))
        .filter((a): a is Action => !!a);

      if (sanitized.length === 0) {
        return next(new ForbiddenError("Insufficient permissions"));
      }

      const perms = user.role?.rolePermissions || [];
      const allowed = new Set(
        perms
          .filter((rp) => rp.permission.isActive)
          .map((rp) => {
            const m = norm(rp.permission.module || "");
            const f = norm(rp.permission.featureKey || "");
            const a = sanitizeAction(rp.permission.action || "");
            return `${m}|${f}|${a}`;
          })
      );

      const ok = sanitized.some((a) => allowed.has(`${mod}|${feat}|${a}`));

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

