import { Response } from "express";

export type CsvColumn<T> = {
  header: string;
  select: (row: T) => any;
};

export function toCsvValue(input: any): string {
  if (input === null || input === undefined) return "";
  if (input instanceof Date) return input.toISOString();
  if (typeof input === "object" && "toISOString" in input) {
    try {
      return (input as any).toISOString();
    } catch {
      return JSON.stringify(input);
    }
  }
  const val =
    typeof input === "boolean"
      ? input ? "true" : "false"
      : typeof input === "number"
      ? Number.isFinite(input) ? String(input) : ""
      : String(input);
  const needsQuote = /[",\n]/.test(val);
  const escaped = val.replace(/"/g, '""');
  return needsQuote ? `"${escaped}"` : escaped;
}

export function streamCsv<T>(
  res: Response,
  filename: string,
  columns: CsvColumn<T>[],
  rows: T[]
): void {
  res.setHeader("Content-Type", "text/csv");
  res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
  res.write(columns.map(c => toCsvValue(c.header)).join(",") + "\n");
  for (const row of rows) {
    const line = columns.map(c => toCsvValue(c.select(row))).join(",");
    res.write(line + "\n");
  }
  res.end();
}

export function buildCsv<T>(
  columns: CsvColumn<T>[],
  rows: T[]
): string {
  const headerLine = columns.map(c => toCsvValue(c.header)).join(",");
  const dataLines = rows.map(row => columns.map(c => toCsvValue(c.select(row))).join(","));
  return [headerLine, ...dataLines].join("\n");
}
