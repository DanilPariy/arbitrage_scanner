import type { TypedBus } from "../streams/bus.js";
import type { AppEvents } from "../streams/events.js";
import type { PerpOpportunity, ExchangeId } from "../../../shared/types.js";
import type { TopOfBook } from "../exchanges/marketTypes.js";
import { MarketState } from "./marketState.js";
import { estimateRoundTripFeesBps } from "./fees.js";
import { FundingStore } from "./fundingStore.js";

export type ArbEngineConfig = {
  minNetEdgeBps: number;
  minTimeAliveMs: number;
  minTopQty: number;
  maxOpps: number;

  // NEW:
  publishIntervalMs: number; // e.g. 500ms = 2Hz, 200ms = 5Hz
  staleOppMs: number;        // drop opp if not refreshed recently
};

type AliveKey = string;

function fundingImpactBps(rate: number, position: "long" | "short") {
  const bps = rate * 10_000;
  // fundingRate > 0 means longs pay, shorts receive
  return position === "long" ? bps : -bps;
}

export class ArbEngine {
  private state = new MarketState();
  private aliveSince = new Map<AliveKey, number>();

  // Global opp registry
  private oppsById = new Map<string, PerpOpportunity>();

  // Throttle state
  private publishTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor(
    private bus: TypedBus<AppEvents>,
    private cfg: ArbEngineConfig,
    private funding?: FundingStore
  ) {}

  start(): () => void {
    const off = this.bus.on("market:top", (top) => this.onTop(top));
    return off;
  }

  private onTop(top: TopOfBook) {
    this.state.upsertTop(top);

    const tops = this.state.getTopsForSymbol(top.symbol);
    if (tops.length < 2) return;

    const now = Date.now();

    // Update global opp registry with fresh candidates for THIS symbol
    this.upsertSymbolOpps(tops, now);

    // Mark dirty and schedule a throttled publish
    this.dirty = true;
    this.schedulePublish();
  }

  private schedulePublish() {
    if (this.publishTimer) return;

    this.publishTimer = setTimeout(() => {
      this.publishTimer = null;
      this.flushPublish();
    }, this.cfg.publishIntervalMs);
  }

  private flushPublish() {
    if (!this.dirty) return;
    this.dirty = false;

    const now = Date.now();

    // Remove stale opps (haven’t been refreshed recently)
    for (const [id, opp] of this.oppsById.entries()) {
      if (now - opp.marketTs > this.cfg.staleOppMs) {
        this.oppsById.delete(id);
        this.aliveSince.delete(id);
      }
    }

    // Global top-N ranking
    const top = Array.from(this.oppsById.values())
      .sort((a, b) => b.netEdgeBps - a.netEdgeBps)
      .slice(0, this.cfg.maxOpps);

    this.bus.emit("opps:update", { top, updatedAt: now });

    // If new updates arrived while we were publishing, publish again soon
    if (this.dirty) this.schedulePublish();
  }

  private upsertSymbolOpps(tops: TopOfBook[], now: number) {
    // For every pair: long on i (ask), short on j (bid)
    for (let i = 0; i < tops.length; i++) {
      for (let j = 0; j < tops.length; j++) {
        if (i === j) continue;

        const long = tops[i]!;
        const short = tops[j]!;

        if (long.askQty < this.cfg.minTopQty) continue;
        if (short.bidQty < this.cfg.minTopQty) continue;

        const longPrice = long.askPrice;
        const shortPrice = short.bidPrice;

        const id = this.makeId(long.symbol, long.exchange, short.exchange);

        // No positive spread → kill opp
        if (shortPrice <= longPrice) {
          this.resetAlive(id);
          this.oppsById.delete(id);
          continue;
        }

        const mid = (longPrice + shortPrice) / 2;
        const grossSpreadBps = ((shortPrice - longPrice) / mid) * 10_000;

        const estFeesBps = estimateRoundTripFeesBps(long.exchange, short.exchange);

        // safety buffer (latency/slippage); tune later
        const bufferBps = 2;
        const netEdgeBps = grossSpreadBps - estFeesBps - bufferBps;

        if (netEdgeBps < this.cfg.minNetEdgeBps) {
          this.resetAlive(id);
          this.oppsById.delete(id);
          continue;
        }

        const timeAliveMs = this.getTimeAlive(id, now);
        if (timeAliveMs < this.cfg.minTimeAliveMs) {
          // keep tracking alive time, but don’t publish yet
          continue;
        }

        const longF = this.funding?.get(long.exchange as ExchangeId, long.symbol);
        const shortF = this.funding?.get(short.exchange as ExchangeId, short.symbol);

        const longRate = longF?.rate ?? null;
        const longTime = longF?.nextFundingTime ?? null;
        const shortRate = shortF?.rate ?? null;
        const shortTime = shortF?.nextFundingTime ?? null;

        let netAfterFundingBps: number | null = null;
        if (longRate !== null && shortRate !== null) {
          const impact = fundingImpactBps(longRate, "long") + fundingImpactBps(shortRate, "short");
          netAfterFundingBps = netEdgeBps - impact;
        }

        const opp: PerpOpportunity = {
          id,
          symbol: long.symbol,
          longExchange: long.exchange,
          shortExchange: short.exchange,
          longPrice,
          shortPrice,
          grossSpreadBps,
          estFeesBps,
          netEdgeBps,
          longTopQty: long.askQty,
          shortTopQty: short.bidQty,
          marketTs: Math.min(long.ts, short.ts),
          longMarketTs: long.ts,
          shortMarketTs: short.ts,
          timeAliveMs,
          longFundingRate: longRate,
          longNextFundingTime: longTime,
          shortFundingRate: shortRate,
          shortNextFundingTime: shortTime,
          netAfterFundingBps
        };

        this.oppsById.set(id, opp);
      }
    }
  }

  private makeId(symbol: string, longEx: ExchangeId, shortEx: ExchangeId) {
    return `${symbol}:${longEx}-${shortEx}`;
  }

  private getTimeAlive(id: AliveKey, now: number) {
    const prev = this.aliveSince.get(id);
    if (prev === undefined) {
      this.aliveSince.set(id, now);
      return 0;
    }
    return now - prev;
  }

  private resetAlive(id: AliveKey) {
    this.aliveSince.delete(id);
  }
}
