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
