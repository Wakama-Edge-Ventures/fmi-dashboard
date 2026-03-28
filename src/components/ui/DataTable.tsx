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
  exportFilename?: string;
  onRowClick?: (row: T) => void;
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

  const [page,    setPage]    = useState(1);
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>("asc");

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

  const totalPages =
    pageSize === Infinity ? 1 : Math.max(1, Math.ceil(sorted.length / pageSize));
  const safePage  = Math.min(page, totalPages);
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
    if (onExport) { onExport(); return; }
    const rows = data.map((row) => {
      const out: Record<string, unknown> = {};
      columns.forEach((col) => { out[col.label] = row[col.key] ?? ""; });
      return out as Record<string, unknown>;
    });
    exportCSV(rows, exportFilename);
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        background: "#0d1423",
        border: "1px solid rgba(255,255,255,0.06)",
        borderRadius: 8,
        overflow: "hidden",
      }}
    >
      {/* Toolbar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "8px 12px",
          borderBottom: "1px solid rgba(255,255,255,0.06)",
        }}
      >
        <p style={{ fontSize: 11, color: "#5a6a85" }}>
          {sorted.length} résultat{sorted.length !== 1 ? "s" : ""}
        </p>
        <button
          onClick={handleExport}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            height: 28,
            paddingLeft: 10,
            paddingRight: 10,
            borderRadius: 6,
            fontSize: 11,
            fontWeight: 500,
            color: "#5a6a85",
            background: "transparent",
            border: "1px solid rgba(255,255,255,0.06)",
            cursor: "pointer",
            transition: "border-color 150ms, color 150ms",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#e8edf5";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.15)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.color = "#5a6a85";
            (e.currentTarget as HTMLButtonElement).style.borderColor = "rgba(255,255,255,0.06)";
          }}
        >
          <span className="material-symbols-outlined" style={{ fontSize: 13, color: "inherit", fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}>
            download
          </span>
          Exporter CSV
        </button>
      </div>

      {/* Table */}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="label-xs"
                  style={{
                    height: 32,
                    padding: "0 12px",
                    textAlign: "left",
                    whiteSpace: "nowrap",
                    userSelect: "none",
                    cursor: col.sortable ? "pointer" : "default",
                  }}
                  onClick={col.sortable ? () => toggleSort(col.key) : undefined}
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {col.label}
                    {col.sortable && (
                      <span
                        className="material-symbols-outlined"
                        style={{
                          fontSize: 12,
                          opacity: sortKey === col.key ? 1 : 0.3,
                          fontVariationSettings: '"FILL" 1, "wght" 300, "GRAD" 0, "opsz" 20',
                          color: sortKey === col.key ? "#10b981" : "inherit",
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
                  style={{
                    padding: "48px 12px",
                    textAlign: "center",
                    fontSize: 12,
                    color: "#5a6a85",
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <span
                      className="material-symbols-outlined"
                      style={{ fontSize: 24, color: "#3a4a60", fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}
                    >
                      table_rows
                    </span>
                    {emptyMessage}
                  </div>
                </td>
              </tr>
            ) : (
              paginated.map((row, i) => (
                <tr
                  key={i}
                  style={{
                    height: 40,
                    borderBottom: "1px solid rgba(255,255,255,0.03)",
                    cursor: onRowClick ? "pointer" : "default",
                    transition: "background 120ms",
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      "rgba(255,255,255,0.02)";
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLTableRowElement).style.background =
                      "transparent";
                  }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      style={{
                        padding: "0 12px",
                        fontSize: 12,
                        color: "#e8edf5",
                        whiteSpace: "nowrap",
                      }}
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
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: 6,
            padding: "8px 12px",
            borderTop: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span style={{ fontSize: 11, color: "#5a6a85", marginRight: 8 }}>
            Page {safePage} / {totalPages}
          </span>

          <PaginationBtn
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage === 1}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: "inherit", fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}>
              chevron_left
            </span>
          </PaginationBtn>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .filter((p) => p === 1 || p === totalPages || Math.abs(p - safePage) <= 1)
            .reduce<(number | "…")[]>((acc, p, idx, arr) => {
              if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("…");
              acc.push(p);
              return acc;
            }, [])
            .map((p, i) =>
              p === "…" ? (
                <span key={`e-${i}`} style={{ fontSize: 11, color: "#3a4a60", padding: "0 2px" }}>…</span>
              ) : (
                <PaginationBtn
                  key={p}
                  onClick={() => setPage(p as number)}
                  active={p === safePage}
                >
                  {p}
                </PaginationBtn>
              )
            )}

          <PaginationBtn
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage === totalPages}
          >
            <span className="material-symbols-outlined" style={{ fontSize: 13, color: "inherit", fontVariationSettings: '"FILL" 0, "wght" 300, "GRAD" 0, "opsz" 20' }}>
              chevron_right
            </span>
          </PaginationBtn>
        </div>
      )}
    </div>
  );
}

function PaginationBtn({
  children,
  onClick,
  disabled = false,
  active = false,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  active?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        height: 28,
        minWidth: 28,
        padding: "0 6px",
        borderRadius: 5,
        fontSize: 11,
        fontWeight: active ? 500 : 400,
        color: active ? "#10b981" : "#5a6a85",
        background: active ? "rgba(16,185,129,0.08)" : "#0d1423",
        border: active
          ? "1px solid rgba(16,185,129,0.3)"
          : "1px solid rgba(255,255,255,0.06)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.35 : 1,
        transition: "background 120ms, border-color 120ms",
      }}
      onMouseEnter={(e) => {
        if (disabled || active) return;
        (e.currentTarget as HTMLButtonElement).style.background = "#111a2e";
      }}
      onMouseLeave={(e) => {
        if (disabled || active) return;
        (e.currentTarget as HTMLButtonElement).style.background = "#0d1423";
      }}
    >
      {children}
    </button>
  );
}
