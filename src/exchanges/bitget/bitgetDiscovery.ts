import { z } from "zod";

const InstrumentsResp = z.object({
  code: z.string().optional(),
  msg: z.string().optional(),
  data: z.union([
    z.array(z.any()),
    z.object({ list: z.array(z.any()) })
  ]).optional()
}).passthrough();

const TickersResp = z.object({
  code: z.string().optional(),
  msg: z.string().optional(),
  data: z.union([
    z.array(z.any()),
    z.object({ list: z.array(z.any()) })
  ]).optional()
}).passthrough();

function normalizeList(json: unknown): any[] {
  const parsed = InstrumentsResp.parse(json);
  const data = parsed.data;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Array.isArray(data.list) ? data.list : [];
}

function normalizeTickers(json: unknown): any[] {
  const parsed = TickersResp.parse(json);
  const data = parsed.data;
  if (!data) return [];
  if (Array.isArray(data)) return data;
  return Array.isArray(data.list) ? data.list : [];
}

function num(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  return NaN;
}

function pickVolume(row: Record<string, unknown>): number {
  const keys = [
    "usdtVolume",
    "quoteVol",
    "quoteVolume",
    "turnover24h",
    "volCcy24h",
    "volume"
  ];
  for (const k of keys) {
    const v = num(row[k]);
    if (Number.isFinite(v)) return v;
  }
  return NaN;
}

export type BitgetDiscoveryConfig = {
  restBaseUrl: string;     // default "https://api.bitget.com"
  productType: string;     // e.g. "USDT-FUTURES" or "UMCBL"
  quote: "USDT";
  minTurnover24h: number;  // liquidity filter (USDT)
  maxInstruments: number;  // cap universe size
};

export async function discoverBitgetUsdtPerps(cfg: BitgetDiscoveryConfig): Promise<string[]> {
  const instUrl = new URL("/api/v2/mix/market/contracts", cfg.restBaseUrl);
  instUrl.searchParams.set("productType", cfg.productType);

  const instRes = await fetch(instUrl);
  if (!instRes.ok) throw new Error(`Bitget instruments HTTP ${instRes.status}`);
  const instJson = await instRes.json();

  const instruments = normalizeList(instJson);
  const symbols = instruments
    .map((row) => ({
      symbol: String(row.symbol ?? row.instId ?? ""),
      quoteCoin: String(row.quoteCoin ?? ""),
      status: String(row.status ?? row.state ?? "")
    }))
    .filter((row) => row.symbol && row.quoteCoin.toUpperCase() === cfg.quote)
    .filter((row) => !row.status || row.status.toUpperCase() === "NORMAL" || row.status.toUpperCase() === "TRADING")
    .map((row) => row.symbol);

  const tUrl = new URL("/api/v2/mix/market/tickers", cfg.restBaseUrl);
  tUrl.searchParams.set("productType", cfg.productType);

  const tRes = await fetch(tUrl);
  if (!tRes.ok) throw new Error(`Bitget tickers HTTP ${tRes.status}`);
  const tJson = await tRes.json();

  const tickers = normalizeTickers(tJson);
  const volBySymbol = new Map<string, number>();
  for (const t of tickers) {
    const symbol = String(t.symbol ?? t.instId ?? "");
    if (!symbol) continue;
    const v = pickVolume(t as Record<string, unknown>);
    if (Number.isFinite(v)) volBySymbol.set(symbol, v);
  }

  const filtered = symbols
    .map((symbol) => ({ symbol, vol: volBySymbol.get(symbol) ?? NaN }))
    .filter((x) => Number.isFinite(x.vol) && x.vol >= cfg.minTurnover24h)
    .sort((a, b) => b.vol - a.vol)
    .slice(0, cfg.maxInstruments)
    .map((x) => x.symbol);

  return filtered;
}
