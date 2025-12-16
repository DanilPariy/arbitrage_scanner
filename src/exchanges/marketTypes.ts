import type { ExchangeId } from "../core/types.js";

export type NormalizedSymbol = string; // you decide convention later, e.g. "BTCUSDT" or "BTC-USDT"

export type TopOfBook = {
  exchange: ExchangeId;
  symbol: NormalizedSymbol;
  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  ts: number; // event time (epoch ms)
};
