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
  return { isActive: true, isApproved: true, validUntil: { lte: now } };
};

export const isDeactivatedWhere = () => {
  return { isActive: false, isApproved: true };
};

export const isPendingApprovalWhere = () => {
  return { isActive: false, isApproved: false };
};

/**
 * Build unified where clause for exchange rate queries
 * Used by both admin and customer endpoints
 */
export const buildRateWhereClause = (filters: RateFilterOptions = {}) => {
  const where: any = {};

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
    Object.assign(where, isActiveWhere());
  } else if (status === "scheduled" || status === "schedule") {
    Object.assign(where, isScheduledWhere());
  } else if (status === "expired") {
    Object.assign(where, isExpiredWhere());
  } else if (status === "deactivated") {
    Object.assign(where, isDeactivatedWhere());
  } else if (status === "pending_approval" || status === "pending") {
    Object.assign(where, isPendingApprovalWhere());
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
  note: true,
  source: true,
  createdAt: true,
  updatedAt: true,
};
