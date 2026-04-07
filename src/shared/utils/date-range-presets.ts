import { ValidationError } from "./errors";

export const AGENT_DASHBOARD_DATE_RANGES = [
  "today",
  "this_week",
  "last_30_days",
  "last_3_months",
  "last_year",
] as const;

export type AgentDashboardDateRangePreset = (typeof AGENT_DASHBOARD_DATE_RANGES)[number];

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

/** Monday 00:00:00.000 UTC of the ISO week containing `now`. */
function startOfIsoWeekUtc(now: Date): Date {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  const day = d.getUTCDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  d.setUTCHours(0, 0, 0, 0);
  return d;
}

function addDaysUtc(d: Date, days: number): Date {
  const out = new Date(d.getTime());
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

/**
 * Resolves agent dashboard date presets to [start, end] in UTC. `end` is always the current instant.
 */
export function resolveDashboardDateRange(preset: string): { start: Date; end: Date } {
  const trimmed = preset?.trim();
  if (!trimmed || !AGENT_DASHBOARD_DATE_RANGES.includes(trimmed as AgentDashboardDateRangePreset)) {
    throw new ValidationError(
      `Invalid range. Use one of: ${AGENT_DASHBOARD_DATE_RANGES.join(", ")}`
    );
  }

  const end = new Date();
  const now = end;

  switch (trimmed as AgentDashboardDateRangePreset) {
    case "today":
      return { start: startOfUtcDay(now), end };
    case "this_week":
      return { start: startOfIsoWeekUtc(now), end };
    case "last_30_days":
      return { start: addDaysUtc(now, -30), end };
    case "last_3_months":
      return { start: addDaysUtc(now, -90), end };
    case "last_year":
      return { start: addDaysUtc(now, -365), end };
    default:
      throw new ValidationError(
        `Invalid range. Use one of: ${AGENT_DASHBOARD_DATE_RANGES.join(", ")}`
      );
  }
}

/** Agent cash stats: calendar last month, or rolling windows for multi-month presets. */
export const AGENT_CASH_STATS_PERIODS = [
  "last_month",
  "last_3_months",
  "last_6_months",
  "last_year",
] as const;

export type AgentCashStatsPeriodPreset = (typeof AGENT_CASH_STATS_PERIODS)[number];

/** Previous calendar month (UTC), from 00:00:00 first day to last ms of last day. */
function lastCalendarMonthRange(now: Date): { start: Date; end: Date } {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const start = new Date(Date.UTC(y, m - 1, 1, 0, 0, 0, 0));
  const endExclusive = new Date(Date.UTC(y, m, 1, 0, 0, 0, 0));
  const end = new Date(endExclusive.getTime() - 1);
  return { start, end };
}

/**
 * Resolves agent cash-stats period query. `last_month` is the prior full calendar month (UTC);
 * other presets roll back from now by days (90 / 180 / 365).
 */
export function resolveAgentCashStatsDateRange(preset: string): { start: Date; end: Date } {
  const trimmed = preset?.trim();
  if (!trimmed || !AGENT_CASH_STATS_PERIODS.includes(trimmed as AgentCashStatsPeriodPreset)) {
    throw new ValidationError(`Invalid period. Use one of: ${AGENT_CASH_STATS_PERIODS.join(", ")}`);
  }

  const endNow = new Date();

  switch (trimmed as AgentCashStatsPeriodPreset) {
    case "last_month":
      return lastCalendarMonthRange(endNow);
    case "last_3_months":
      return { start: addDaysUtc(endNow, -90), end: endNow };
    case "last_6_months":
      return { start: addDaysUtc(endNow, -180), end: endNow };
    case "last_year":
      return { start: addDaysUtc(endNow, -365), end: endNow };
    default:
      throw new ValidationError(`Invalid period. Use one of: ${AGENT_CASH_STATS_PERIODS.join(", ")}`);
  }
}
