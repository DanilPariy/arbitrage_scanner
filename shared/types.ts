export type ExchangeId =
  | "binance"
  | "bybit"
  | "okx"
  | "bitget"
  | "htx"
  | "kucoin";

export type PerpOpportunity = {
  id: string; // stable unique id (ex: "SOL-USDT:binance-bybit")
  symbol: string; // normalized symbol, ex: "SOLUSDT" or "SOL-USDT" (your choice)
  longExchange: ExchangeId; // where you go long
  shortExchange: ExchangeId; // where you go short
  longPrice: number;
  shortPrice: number;

  // profitability model (later you'll get more detailed)
  grossSpreadBps: number; // (shortPrice - longPrice)/mid * 10_000
  estFeesBps: number; // sum of taker fees (or maker if you do passive)
  netEdgeBps: number; // gross - fees - buffers

  // funding for next settlement
  longFundingRate: number | null; // decimal rate, e.g. 0.0001
  longNextFundingTime: number | null; // epoch ms
  shortFundingRate: number | null;
  shortNextFundingTime: number | null;

  // netEdge adjusted by funding (in bps)
  netAfterFundingBps: number | null;

  // liquidity filters (later filled from depth)
  longTopQty?: number;
  shortTopQty?: number;

  // meta for ranking / stability
  observedAt: number; // epoch ms
  timeAliveMs: number; // how long this opp has remained above threshold
};

export type FundingOpportunity = {
  id: string; // stable unique id (ex: "SOL-USDT:binance-bybit")
  symbol: string; // normalized symbol
  longExchange: ExchangeId; // where you go long (pay/receive funding)
  shortExchange: ExchangeId; // where you go short (pay/receive funding)

  longPrice: number; // best ask used for entry cost
  shortPrice: number; // best bid used for entry cost

  // funding inputs
  longFundingRate: number; // decimal rate
  longNextFundingTime: number; // epoch ms
  shortFundingRate: number; // decimal rate
  shortNextFundingTime: number; // epoch ms

  // edge and cost (bps)
  fundingEdgeBps: number; // (shortRate - longRate) * 10_000
  entryCostBps: number; // max(0, (longPrice - shortPrice)/mid * 10_000)

  // liquidity filters
  longTopQty?: number;
  shortTopQty?: number;

  // meta
  observedAt: number; // epoch ms
  timeAliveMs: number; // how long this opp has remained above threshold
};

export type OppsUpdate = {
  top: PerpOpportunity[];
  updatedAt: number;
};

export type FundingOppsUpdate = {
  top: FundingOpportunity[];
  updatedAt: number;
};

export type SseEvents = {
  snapshot: OppsUpdate;
  opps: OppsUpdate;
  ping: { t: number };
};
