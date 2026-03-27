"use client";

import { useState, useMemo } from "react";
import { exportCSV } from "@/src/lib/utils";

export interface Column<T> {
  key: string;
  label: string;
  sortable?: boolean;
  render?: (value: unknown, row: T) => React.ReactNode;
}

interface PaginationProps {
  pageSize?: number;
}

interface DataTableProps<T extends Record<string, unknown>> {
  columns: Column<T>[];
  data: T[];
  pagination?: PaginationProps | boolean;
  onExport?: () => void;
  /** Filename for the CSV export (default: "export.csv") */
  exportFilename?: string;
  /** Optional row click handler */
  onRowClick?: (row: T) => void;
  /** Empty state message */
  emptyMessage?: string;
}

type SortDir = "asc" | "desc";

export default function DataTable<T extends Record<string, unknown>>({
  columns,
  data,
  pagination = true,
  onExport,
  exportFilename = "export.csv",
  onRowClick,
  emptyMessage = "Aucune donnée disponible",
}: DataTableProps<T>) {
  const pageSize =
    pagination === true
      ? 10
      : pagination === false
      ? Infinity
      : (pagination.pageSize ?? 10);

  const [page, setPage] = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

  // Sorting
  const sorted = useMemo(() => {
    if (!sortKey) return data;
    return [...data].sort((a, b) => {
      const av = a[sortKey];
      const bv = b[sortKey];
      if (av === bv) return 0;
      const cmp =
        typeof av === "number" && typeof bv === "number"
          ? av - bv
          : String(av ?? "").localeCompare(String(bv ?? ""), "fr");
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [data, sortKey, sortDir]);

  // Pagination
  const totalPages =
    pageSize === Infinity ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginated =
    pageSize === Infinity
      ? sorted
      : sorted.slice((safePage - 1) * pageSize, safePage * pageSize);

  function toggleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  }

  function handleExport() {
    if (onExport) {
      onExport();
      return;
    }
    const rows = data.map((row) => {
      const out: Record<string, unknown> = {};
      columns.forEach((col) => {
        out[col.label] = row[col.key] ?? "";
      });
      return out as Record<string, unknown>;
    });
    exportCSV(rows, exportFilename);
  }

  return (
    <div className="flex flex-col gap-0 rounded-xl border border-gray-800 overflow-hidden bg-bg-secondary">
      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
        <p className="text-xs text-text-muted">
          {sorted.length} résultat{sorted.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={handleExport}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary bg-bg-tertiary hover:bg-bg-hover hover:text-text-primary border border-gray-700 transition-colors"
        >
          <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
            download
          </span>
          Exporter CSV
        </button>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-gray-900">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={[
                    "px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted select-none whitespace-nowrap",
                    col.sortable
                      ? "cursor-pointer hover:text-text-primary transition-colors"
                      : "",
                  ].join(" ")}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  <span className="inline-flex items-center gap-1">
                    {col.label}
                    {col.sortable && (
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 14,
                          opacity:
                            sortKey === col.key ? 1 : 0.3,
                          fontVariationSettings:
                            '"FILL" 1, "wght" 400, "GRAD" 0, "opsz" 20',
                        }}
                      >
                        {sortKey === col.key && sortDir === "desc"
                          ? "arrow_downward"
                          : "arrow_upward"}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {paginated.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-4 py-12 text-center text-sm text-text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr
                  key={i}
                  className={[
                    "border-b border-gray-800 last:border-0 transition-colors",
                    onRowClick
                      ? "cursor-pointer hover:bg-gray-800/50"
                      : "hover:bg-gray-800/30",
                  ].join(" ")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className="px-4 py-3 text-sm text-text-primary whitespace-nowrap"
                    >
                      {col.render
                        ? col.render(row[col.key], row)
                        : String(row[col.key] ?? "—")}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {pagination !== false && totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-800">
          <p className="text-xs text-text-muted">
            Page {safePage} sur {totalPages} —{" "}
            {(safePage - 1) * pageSize + 1}–
            {Math.min(safePage * pageSize, sorted.length)} sur {sorted.length}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={safePage === 1}
              className="flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                chevron_left
              </span>
            </button>

            {/* Page numbers — show up to 5 */}
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(
                (p) =>
                  p === 1 ||
                  p === totalPages ||
                  Math.abs(p - safePage) <= 1
              )
              .reduce<(number | "…")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                  acc.push("…");
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === "…" ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-xs text-text-muted">
                    …
                  </span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p as number)}
                    className={[
                      "flex items-center justify-center w-7 h-7 rounded-md text-xs font-medium transition-colors",
                      p === safePage
                        ? "bg-accent text-white"
                        : "text-text-secondary hover:bg-bg-hover",
                    ].join(" ")}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={safePage === totalPages}
              className="flex items-center justify-center w-7 h-7 rounded-md text-text-secondary hover:bg-bg-hover disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 16 }}>
                chevron_right
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
