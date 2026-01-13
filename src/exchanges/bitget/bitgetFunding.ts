import { z } from "zod";

const FundingResp = z.object({
  code: z.string(),
  msg: z.string().optional(),
  data: z.array(
    z.object({
      symbol: z.string(),
      fundingRate: z.string().optional(),
      nextUpdate: z.string().optional(),
      nextFundingTime: z.string().optional()
    }).passthrough()
  )
}).passthrough();

function num(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  return NaN;
}

export async function fetchBitgetFunding(
  restBaseUrl: string,
  exchangeSymbol: string,
  productType: string
) {
  const u = new URL("/api/v2/mix/market/current-fund-rate", restBaseUrl);
  u.searchParams.set("symbol", exchangeSymbol);
  u.searchParams.set("productType", productType);

  const res = await fetch(u);
  if (!res.ok) throw new Error(`Bitget funding ${res.status}`);
  const json = FundingResp.parse(await res.json());
  if (json.code !== "00000") throw new Error(`Bitget funding error ${json.code}`);

  const row = json.data.find((r) => r.symbol === exchangeSymbol) ?? json.data[0];
  if (!row) throw new Error("Bitget funding empty");

  const rate = num(row.fundingRate);
  const nextFundingTime = num(row.nextUpdate ?? row.nextFundingTime);

  return { rate, nextFundingTime };
}
