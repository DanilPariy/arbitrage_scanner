import { z } from "zod";

const PremiumIndexResp = z.object({
  symbol: z.string(),
  lastFundingRate: z.string(),   // decimal string
  nextFundingTime: z.coerce.number()
}).passthrough();

export async function fetchBinanceFunding(restBaseUrl: string, exchangeSymbol: string) {
  const u = new URL("/fapi/v1/premiumIndex", restBaseUrl); // USD-M premiumIndex :contentReference[oaicite:2]{index=2}
  u.searchParams.set("symbol", exchangeSymbol);

  const res = await fetch(u);
  if (!res.ok) throw new Error(`Binance premiumIndex ${res.status}`);

  const json = PremiumIndexResp.parse(await res.json());

  return {
    rate: Number(json.lastFundingRate),
    nextFundingTime: Number(json.nextFundingTime)
  };
}
