"use client";

import React, { useMemo, useState } from "react";
import { useSse } from "../lib/useSse";
import type { OppsUpdate, PerpOpportunity, SseEvents } from "../lib/types";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

function fmt(n: number, digits = 2) {
  return Number.isFinite(n) ? n.toFixed(digits) : "—";
}

function ageMs(ts: number) {
  const d = Date.now() - ts;
  if (d < 1000) return `${d}ms`;
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m`;
}

export default function Page() {
  const [data, setData] = useState<OppsUpdate>({ top: [], updatedAt: 0 });
  const [lastPing, setLastPing] = useState<number | null>(null);

  const { status } = useSse<SseEvents>(`${API_BASE}/stream/opps`, {
    snapshot: (d) => setData(d),
    opps: (d) => setData(d),
    ping: (p) => setLastPing(p.t)
  });

  const [sorting, setSorting] = useState<SortingState>([
    { id: "netEdgeBps", desc: true }
  ]);

  const columns = useMemo<ColumnDef<PerpOpportunity>[]>(
    () => [
      { header: "Symbol", accessorKey: "symbol" },

      { header: "Long ex", accessorKey: "longExchange" },
      { header: "Short ex", accessorKey: "shortExchange" },

      {
        header: "Long (ask)",
        accessorKey: "longPrice",
        cell: (ctx) => fmt(ctx.getValue<number>(), 6)
      },
      {
        header: "Short (bid)",
        accessorKey: "shortPrice",
        cell: (ctx) => fmt(ctx.getValue<number>(), 6)
      },
      { header: "Gross bps", accessorKey: "grossSpreadBps", cell: (ctx) => fmt(ctx.getValue<number>(), 2) },
      { header: "Fees bps", accessorKey: "estFeesBps", cell: (ctx) => fmt(ctx.getValue<number>(), 2) },
      { header: "Net bps", accessorKey: "netEdgeBps", cell: (ctx) => fmt(ctx.getValue<number>(), 2) },

      { header: "Alive", accessorKey: "timeAliveMs", cell: (ctx) => `${Math.floor(ctx.getValue<number>() / 1000)}s` },
      { header: "Seen", accessorKey: "observedAt", cell: (ctx) => ageMs(ctx.getValue<number>()) }
    ],
    []
  );

  const table = useReactTable({
    data: data.top,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <main style={{ padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 12 }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Perps Arb Scanner</h1>
        <span>status: <b>{status}</b></span>
        <span>updatedAt: <b>{data.updatedAt ? ageMs(data.updatedAt) : "—"}</b></span>
        <span>ping: <b>{lastPing ? ageMs(lastPing) : "—"}</b></span>
        <span>rows: <b>{data.top.length}</b></span>
      </div>

      <div style={{ overflowX: "auto", border: "1px solid #ddd", borderRadius: 8 }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id}>
                {hg.headers.map((h) => (
                  <th
                    key={h.id}
                    onClick={h.column.getToggleSortingHandler()}
                    style={{
                      textAlign: "left",
                      padding: "10px 12px",
                      borderBottom: "1px solid #eee",
                      cursor: h.column.getCanSort() ? "pointer" : "default",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {String(h.column.columnDef.header)}
                    {h.column.getIsSorted() === "asc" ? " ▲" : ""}
                    {h.column.getIsSorted() === "desc" ? " ▼" : ""}
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id}>
                {row.getVisibleCells().map((cell) => (
                  <td
                    key={cell.id}
                    style={{
                      padding: "10px 12px",
                      borderBottom: "1px solid #f2f2f2",
                      whiteSpace: "nowrap"
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
            {table.getRowModel().rows.length === 0 && (
              <tr>
                <td style={{ padding: 12 }} colSpan={columns.length}>
                  No opportunities yet (or filtered out by minTimeAlive / minNetEdge).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
