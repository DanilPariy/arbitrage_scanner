import type { AppContext } from "../app/context.js";
import type { PerpOpportunity } from "./types.js";

export function startFakeEngine(ctx: AppContext) {
  let aliveStart = Date.now();

  setInterval(() => {
    const now = Date.now();
    const top: PerpOpportunity[] = [
      {
        id: "TESTCOIN-USDT:binance-bybit",
        symbol: "TESTCOIN-USDT",
        longExchange: "binance",
        shortExchange: "bybit",
        longPrice: 100 + Math.random(),
        shortPrice: 100.2 + Math.random(),
        grossSpreadBps: 20 + Math.random() * 10,
        estFeesBps: 8,
        netEdgeBps: 12 + Math.random() * 10,
        observedAt: now,
        timeAliveMs: now - aliveStart
      }
    ];

    ctx.opps.setTop(top);
  }, 1000);
}
