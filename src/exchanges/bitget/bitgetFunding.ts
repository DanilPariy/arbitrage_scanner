import { z } from "zod";

const FundingResp = z.object({
  code: z.string().optional(),
  msg: z.string().optional(),
  data: z.any().optional()
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

  const data = json.data ?? {};
  const rate = num((data as any).fundingRate ?? (data as any).fundRate);
  const nextFundingTime = num((data as any).nextFundingTime ?? (data as any).nextFundTime);

  return { rate, nextFundingTime };
}
