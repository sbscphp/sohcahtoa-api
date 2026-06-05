/**
 * Shared utility for building exchange rate query filters
 */

export interface RateFilterOptions {
  search?: string;
  status?: string;
  fromCurrency?: string;
  toCurrency?: string;
}

/**
 * Helper functions for rate status filters
 */
export const isActiveWhere = (now: Date = new Date()) => {
  return { isActive: true, isApproved: true, validFrom: { lte: now }, validUntil: { gt: now } };
};

export const isScheduledWhere = (now: Date = new Date()) => {
  return { isActive: true, isApproved: true, validFrom: { gt: now } };
};

export const isExpiredWhere = (now: Date = new Date()) => {
  return { validUntil: { lte: now } };
};

export const isPendingApprovalWhere = (now: Date = new Date()) => {
  return { isApproved: false, currentWorkflowStageId: { not: null }, validUntil: { gt: now } };
};

export const isRejectedWhere = (now: Date = new Date()) => {
  return { isApproved: false, currentWorkflowStageId: null, validUntil: { gt: now } };
};

export const isDeactivatedWhere = (now: Date = new Date()) => {
  return {
    isActive: false,
    isApproved: true,
    validUntil: { gt: now },
  };
};

/**
 * Build unified where clause for exchange rate queries
 * Used by both admin and customer endpoints
 */
export const buildRateWhereClause = (filters: RateFilterOptions = {}) => {
  const where: any = {};
  const now = new Date();

  // Search by currency codes
  if (filters.search) {
    const search = filters.search.toString().trim();
    if (search) {
      where.OR = [
        { fromCurrency: { contains: search, mode: "insensitive" } },
        { toCurrency: { contains: search, mode: "insensitive" } },
      ];
    }
  }

  // Filter by specific currencies
  if (filters.fromCurrency) {
    where.fromCurrency = filters.fromCurrency.toUpperCase();
  }
  if (filters.toCurrency) {
    where.toCurrency = filters.toCurrency.toUpperCase();
  }

  // Filter by status
  const status = (filters.status || "all").toString().toLowerCase();
  if (status === "active") {
    Object.assign(where, isActiveWhere(now));
  } else if (status === "scheduled" || status === "schedule") {
    Object.assign(where, isScheduledWhere(now));
  } else if (status === "expired") {
    Object.assign(where, isExpiredWhere(now));
  } else if (status === "deactivated") {
    Object.assign(where, isDeactivatedWhere(now));
  } else if (status === "pending_approval" || status === "pendingapproval") {
    Object.assign(where, isPendingApprovalWhere(now));
  } else if (status === "rejected") {
    Object.assign(where, isRejectedWhere(now));
  }

  return where;
};

/**
 * Standard select fields for rate queries
 * Ensures consistent response format across endpoints
 */
export const rateSelectFields = {
  id: true,
  fromCurrency: true,
  toCurrency: true,
  buyRate: true,
  sellRate: true,
  validFrom: true,
  validUntil: true,
  isActive: true,
  isApproved: true,
  workflowTemplateId: true,
  currentWorkflowStageId: true,
};

