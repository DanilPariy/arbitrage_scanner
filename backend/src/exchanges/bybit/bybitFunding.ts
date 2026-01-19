import { z } from "zod";

const TickerResp = z.object({
  retCode: z.number(),
  retMsg: z.string().optional(),
  result: z.object({
    list: z.array(
      z.object({
        symbol: z.string(),
        fundingRate: z.string().optional(),
        nextFundingTime: z.string().optional()
      }).passthrough()
    )
  }).passthrough()
});

export async function fetchBybitFunding(restBaseUrl: string, exchangeSymbol: string) {
  const u = new URL("/v5/market/tickers", restBaseUrl);
  u.searchParams.set("category", "linear");
  u.searchParams.set("symbol", exchangeSymbol);

  const res = await fetch(u);
  if (!res.ok) throw new Error(`Bybit tickers ${res.status}`);
  const json = TickerResp.parse(await res.json());

  const row = json.result.list.find((r) => r.symbol === exchangeSymbol) ?? json.result.list[0];
  if (!row) throw new Error("Bybit tickers empty");

  const rate = Number(row.fundingRate);
  const nextFundingTime = Number(row.nextFundingTime);

  return { rate, nextFundingTime };
}
