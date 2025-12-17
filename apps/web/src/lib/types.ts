export type ExchangeId = "binance" | "bybit" | "okx" | "htx" | "kucoin";

export type PerpOpportunity = {
  id: string;
  symbol: string; // canonical like BTC-USDT-PERP
  longExchange: ExchangeId;
  shortExchange: ExchangeId;
  longPrice: number;
  shortPrice: number;
  grossSpreadBps: number;
  estFeesBps: number;
  netEdgeBps: number;
  longTopQty?: number;
  shortTopQty?: number;
  observedAt: number;
  timeAliveMs: number;
};

export type OppsUpdate = {
  top: PerpOpportunity[];
  updatedAt: number;
};

export type SseEvents = {
  snapshot: OppsUpdate;
  opps: OppsUpdate;
  ping: { t: number };
};
