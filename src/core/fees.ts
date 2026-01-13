import type { ExchangeId } from "./types.js";

// Keep as config constants for now.
// Later: make it per VIP level, maker/taker, funding, etc.
export const takerFeeBps: Record<ExchangeId, number> = {
  binance: 4, // 0.04%
  bybit: 6,   // placeholder
  okx: 5,     // placeholder
  htx: 6,     // placeholder
  kucoin: 6,   // placeholder
  bitget: 6
};

// round-trip taker fees: you pay taker on BOTH legs (buy+sell)
export function estimateRoundTripFeesBps(longEx: ExchangeId, shortEx: ExchangeId) {
  return takerFeeBps[longEx] + takerFeeBps[shortEx];
}
