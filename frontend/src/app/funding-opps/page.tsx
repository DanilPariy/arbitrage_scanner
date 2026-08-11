"use client";

import React, { useMemo, useState } from "react";
import { useSse } from "../../lib/useSse";
import type { FundingOppsUpdate, FundingOpportunity } from "@shared/types";
import {
  ColumnDef,
  flexRender,
  getCoreRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import Link from "next/link";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE!;

type FundingSseEvents = {
  snapshot: FundingOppsUpdate;
  opps: FundingOppsUpdate;
  ping: { t: number };
};

function fmt(n: number, digits = 2) {
  return Number.isFinite(n) ? n.toFixed(digits) : "--";
}

function ageMs(ts: number) {
  const d = Date.now() - ts;
  if (d < 1000) return `${d}ms`;
  const s = Math.floor(d / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return `${m}m`;
}

function fmtBpsFromRate(rate: number) {
  return (rate * 10_000).toFixed(2);
}

function fmtTime(ts: number) {
  const d = ts - Date.now();
  if (d <= 0) return "due";

  const totalSeconds = Math.floor(d / 1000);
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;

  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export default function Page() {
  const [data, setData] = useState<FundingOppsUpdate>({ top: [], updatedAt: 0 });
  const [lastPing, setLastPing] = useState<number | null>(null);
  const [symbolFilter, setSymbolFilter] = useState("");
  const [exchangeFilter, setExchangeFilter] = useState<string[]>([]);

  const { status } = useSse<FundingSseEvents>(`${API_BASE}/stream/funding-opps`, {
    snapshot: (d) => setData(d),
    opps: (d) => setData(d),
    ping: (p) => setLastPing(p.t)
  });

  const [sorting, setSorting] = useState<SortingState>([
    { id: "fundingEdgeBps", desc: true }
  ]);

  const exchanges = useMemo(() => {
    const set = new Set<string>();
    for (const opp of data.top) {
      set.add(opp.longExchange);
      set.add(opp.shortExchange);
    }
    return Array.from(set).sort();
  }, [data.top]);

  const filteredData = useMemo(() => {
    const symbolNeedle = symbolFilter.trim().toUpperCase();
    const exchangeSet = new Set(exchangeFilter);

    return data.top.filter((opp) => {
      if (symbolNeedle && !opp.symbol.toUpperCase().includes(symbolNeedle)) return false;

      if (exchangeSet.size > 0) {
        if (!exchangeSet.has(opp.longExchange) && !exchangeSet.has(opp.shortExchange)) return false;
      }

      return true;
    });
  }, [data.top, symbolFilter, exchangeFilter]);

  const columns = useMemo<ColumnDef<FundingOpportunity>[]>(
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

      { header: "Long FR (bps)", id: "lfr", cell: (ctx) => fmtBpsFromRate(ctx.row.original.longFundingRate) },
      { header: "Long FR in", id: "lft", cell: (ctx) => fmtTime(ctx.row.original.longNextFundingTime) },

      { header: "Short FR (bps)", id: "sfr", cell: (ctx) => fmtBpsFromRate(ctx.row.original.shortFundingRate) },
      { header: "Short FR in", id: "sft", cell: (ctx) => fmtTime(ctx.row.original.shortNextFundingTime) },

      { header: "Funding edge (bps)", accessorKey: "fundingEdgeBps", cell: (ctx) => fmt(ctx.getValue<number>(), 2) },
      { header: "Spread (bps)", accessorKey: "spreadBps", cell: (ctx) => fmt(ctx.getValue<number>(), 2) },
      { header: "Entry cost (bps)", accessorKey: "entryCostBps", cell: (ctx) => fmt(ctx.getValue<number>(), 2) },

      { header: "Alive", accessorKey: "timeAliveMs", cell: (ctx) => `${Math.floor(ctx.getValue<number>() / 1000)}s` },
      { header: "Seen", accessorKey: "marketTs", cell: (ctx) => ageMs(ctx.getValue<number>()) },
      { header: "Long seen", accessorKey: "longMarketTs", cell: (ctx) => ageMs(ctx.getValue<number>()) },
      { header: "Short seen", accessorKey: "shortMarketTs", cell: (ctx) => ageMs(ctx.getValue<number>()) }
    ],
    []
  );

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel()
  });

  return (
    <main style={{ padding: 16, fontFamily: "ui-sans-serif, system-ui" }}>
      <div style={{ display: "flex", gap: 12, alignItems: "baseline", marginBottom: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 20, fontWeight: 700 }}>Funding Opps</h1>
        <span>status: <b>{status}</b></span>
        <span>updatedAt: <b>{data.updatedAt ? ageMs(data.updatedAt) : "--"}</b></span>
        <span>ping: <b>{lastPing ? ageMs(lastPing) : "--"}</b></span>
        <span>rows: <b>{filteredData.length}</b> / {data.top.length}</span>
        <Link href="/perps-opps" style={{ marginLeft: "auto" }}>Perps Arb</Link>
      </div>

      <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap", marginBottom: 12 }}>
        <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span>Symbol</span>
          <input
            value={symbolFilter}
            onChange={(e) => setSymbolFilter(e.target.value)}
            placeholder="BTC, ETH, SOL..."
            style={{ padding: "6px 8px", border: "1px solid #ddd", borderRadius: 6, minWidth: 180 }}
          />
        </label>

        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          <span>Exchanges</span>
          {exchanges.map((ex) => {
            const checked = exchangeFilter.includes(ex);
            return (
              <label key={ex} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <input
                  type="checkbox"
                  checked={checked}
                  onChange={(e) => {
                    setExchangeFilter((prev) => {
                      if (e.target.checked) return Array.from(new Set([...prev, ex]));
                      return prev.filter((x) => x !== ex);
                    });
                  }}
                />
                <span>{ex}</span>
              </label>
            );
          })}
        </div>

        <button
          onClick={() => {
            setSymbolFilter("");
            setExchangeFilter([]);
          }}
          style={{ padding: "6px 10px", border: "1px solid #ddd", borderRadius: 6, background: "#f8f8f8" }}
        >
          Clear
        </button>
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
                    {h.column.getIsSorted() === "asc" ? " ^" : ""}
                    {h.column.getIsSorted() === "desc" ? " v" : ""}
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
                  No funding opportunities yet (or filtered out by minTimeAlive / minFundingEdge).
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
