import { z } from "zod";

const InstrumentsResp = z.object({
  retCode: z.number(),
  retMsg: z.string().optional(),
  result: z.object({
    list: z.array(
      z.object({
        symbol: z.string(),
        quoteCoin: z.string().optional(),
        contractType: z.string().optional(),
        status: z.string().optional()
      }).passthrough()
    )
  }).passthrough()
});

const TickersResp = z.object({
  retCode: z.number(),
  retMsg: z.string().optional(),
  result: z.object({
    list: z.array(
      z.object({
        symbol: z.string(),
        turnover24h: z.string().optional(),
        volume24h: z.string().optional()
      }).passthrough()
    )
  }).passthrough()
});

function num(x: string | undefined): number {
  if (!x) return NaN;
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

export type BybitDiscoveryConfig = {
  restBaseUrl: string;     // default "https://api.bybit.com"
  quote: "USDT";           // only USDT linear perps
  minTurnover24h: number;  // liquidity filter (USDT)
  maxInstruments: number;  // cap to avoid huge fanout
};

export async function discoverBybitUsdtPerps(cfg: BybitDiscoveryConfig): Promise<string[]> {
  // 1) instruments list: GET /v5/market/instruments-info?category=linear
  const instUrl = new URL("/v5/market/instruments-info", cfg.restBaseUrl);
  instUrl.searchParams.set("category", "linear");

  const instRes = await fetch(instUrl);
  if (!instRes.ok) throw new Error(`Bybit instruments HTTP ${instRes.status}`);
  const instJson = InstrumentsResp.parse(await instRes.json());

  const tradable = instJson.result.list.filter((row) => {
    const quoteOk = (row.quoteCoin ?? "").toUpperCase() === cfg.quote;
    const statusOk = !row.status || row.status.toUpperCase() === "TRADING";
    const type = (row.contractType ?? "").toUpperCase();
    const typeOk = !type || type.includes("LINEAR");
    return quoteOk && statusOk && typeOk;
  });

  const symbols = tradable.map((row) => row.symbol);

  // 2) tickers snapshot for linear: GET /v5/market/tickers?category=linear
  const tUrl = new URL("/v5/market/tickers", cfg.restBaseUrl);
  tUrl.searchParams.set("category", "linear");

  const tRes = await fetch(tUrl);
  if (!tRes.ok) throw new Error(`Bybit tickers HTTP ${tRes.status}`);
  const tJson = TickersResp.parse(await tRes.json());

  const volBySymbol = new Map<string, number>();
  for (const t of tJson.result.list) {
    const v = Number.isFinite(num(t.turnover24h)) ? num(t.turnover24h) : num(t.volume24h);
    if (Number.isFinite(v)) volBySymbol.set(t.symbol, v);
  }

  const filtered = symbols
    .map((symbol) => ({ symbol, vol: volBySymbol.get(symbol) ?? NaN }))
    .filter((x) => Number.isFinite(x.vol) && x.vol >= cfg.minTurnover24h)
    .sort((a, b) => b.vol - a.vol)
    .slice(0, cfg.maxInstruments)
    .map((x) => x.symbol);

  return filtered;
}
