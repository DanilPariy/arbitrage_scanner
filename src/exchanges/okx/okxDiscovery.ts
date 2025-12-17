import { z } from "zod";

const InstrumentsResp = z.object({
  code: z.string(),
  msg: z.string().optional(),
  data: z.array(
    z.object({
      instId: z.string(),      // e.g. BTC-USDT-SWAP
      instType: z.string(),    // SWAP
      state: z.string().optional()
    }).passthrough()
  )
});

const TickersResp = z.object({
  code: z.string(),
  msg: z.string().optional(),
  data: z.array(
    z.object({
      instType: z.string(),
      instId: z.string(),
      bidPx: z.string().optional(),
      askPx: z.string().optional(),
      volCcy24h: z.string().optional(), // 24h volume in quote currency for SPOT; for SWAP it's still useful as liquidity proxy :contentReference[oaicite:3]{index=3}
      vol24h: z.string().optional(),
      ts: z.string().optional()
    }).passthrough()
  )
});

function num(x: string | undefined): number {
  if (!x) return NaN;
  const n = Number(x);
  return Number.isFinite(n) ? n : NaN;
}

export type OkxDiscoveryConfig = {
  restBaseUrl: string;     // default "https://www.okx.com"
  quote: "USDT";           // for now only USDT
  minVolCcy24h: number;    // e.g. 1_000_000 (USDT)
  maxInstruments: number;  // cap to avoid huge fanout
};

export async function discoverOkxUsdtSwaps(cfg: OkxDiscoveryConfig): Promise<string[]> {
  // 1) instruments list: GET /api/v5/public/instruments?instType=SWAP :contentReference[oaicite:4]{index=4}
  const instUrl = new URL("/api/v5/public/instruments", cfg.restBaseUrl);
  instUrl.searchParams.set("instType", "SWAP");

  const instRes = await fetch(instUrl);
  if (!instRes.ok) throw new Error(`OKX instruments HTTP ${instRes.status}`);
  const instJson = InstrumentsResp.parse(await instRes.json());

  const usdtSwaps = instJson.data
    .map((d) => d.instId)
    .filter((instId) => instId.endsWith(`-${cfg.quote}-SWAP`));

  // 2) tickers snapshot for SWAP: GET /api/v5/market/tickers?instType=SWAP :contentReference[oaicite:5]{index=5}
  const tUrl = new URL("/api/v5/market/tickers", cfg.restBaseUrl);
  tUrl.searchParams.set("instType", "SWAP");

  const tRes = await fetch(tUrl);
  if (!tRes.ok) throw new Error(`OKX tickers HTTP ${tRes.status}`);
  const tJson = TickersResp.parse(await tRes.json());

  // Map instId -> volCcy24h
  const volByInst = new Map<string, number>();
  for (const t of tJson.data) {
    if (!t.instId.endsWith(`-${cfg.quote}-SWAP`)) continue;
    const v = num(t.volCcy24h);
    if (Number.isFinite(v)) volByInst.set(t.instId, v);
  }

  // 3) filter by liquidity and sort by volume desc
  const filtered = usdtSwaps
    .map((instId) => ({ instId, vol: volByInst.get(instId) ?? NaN }))
    .filter((x) => Number.isFinite(x.vol) && x.vol >= cfg.minVolCcy24h)
    .sort((a, b) => b.vol - a.vol)
    .slice(0, cfg.maxInstruments)
    .map((x) => x.instId);

  return filtered;
}
