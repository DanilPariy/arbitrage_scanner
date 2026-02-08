import type { TypedBus } from "../streams/bus.js";
import type { AppEvents } from "../streams/events.js";
import type { FundingOpportunity, ExchangeId } from "../../../shared/types.js";
import type { TopOfBook } from "../exchanges/marketTypes.js";
import { MarketState } from "./marketState.js";
import { FundingStore } from "./fundingStore.js";
import type { CanonicalSymbol } from "./symbols.js";

export type FundingOppEngineConfig = {
  minFundingEdgeBps: number;
  minTimeAliveMs: number;
  minTopQty: number;
  maxOpps: number;

  publishIntervalMs: number;
  staleOppMs: number;
};

type AliveKey = string;

export class FundingOppEngine {
  private state = new MarketState();
  private aliveSince = new Map<AliveKey, number>();
  private oppsById = new Map<string, FundingOpportunity>();

  private publishTimer: NodeJS.Timeout | null = null;
  private dirty = false;

  constructor(
    private bus: TypedBus<AppEvents>,
    private cfg: FundingOppEngineConfig,
    private funding: FundingStore
  ) {}

  start(): () => void {
    const offTop = this.bus.on("market:top", (top) => this.onTop(top));
    const offFunding = this.bus.on("funding:update", (payload) => this.onFunding(payload.symbol));
    return () => {
      offTop();
      offFunding();
    };
  }

  private onTop(top: TopOfBook) {
    this.state.upsertTop(top);
    this.upsertSymbolOpps(top.symbol, Date.now());
    this.markDirty();
  }

  private onFunding(symbol: CanonicalSymbol) {
    this.upsertSymbolOpps(symbol, Date.now());
    this.markDirty();
  }

  private markDirty() {
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

    for (const [id, opp] of this.oppsById.entries()) {
      if (now - opp.observedAt > this.cfg.staleOppMs) {
        this.oppsById.delete(id);
        this.aliveSince.delete(id);
      }
    }

    const top = Array.from(this.oppsById.values())
      .sort((a, b) => b.fundingEdgeBps - a.fundingEdgeBps)
      .slice(0, this.cfg.maxOpps);

    this.bus.emit("funding:opps", { top, updatedAt: now });

    if (this.dirty) this.schedulePublish();
  }

  private upsertSymbolOpps(symbol: CanonicalSymbol, now: number) {
    const tops = this.state.getTopsForSymbol(symbol);
    if (tops.length < 2) return;

    for (let i = 0; i < tops.length; i++) {
      for (let j = 0; j < tops.length; j++) {
        if (i === j) continue;

        const long = tops[i]!;
        const short = tops[j]!;

        if (long.askQty < this.cfg.minTopQty) continue;
        if (short.bidQty < this.cfg.minTopQty) continue;

        const longF = this.funding.get(long.exchange as ExchangeId, symbol);
        const shortF = this.funding.get(short.exchange as ExchangeId, symbol);
        if (!longF || !shortF) continue;

        const longRate = longF.rate;
        const shortRate = shortF.rate;
        const fundingEdgeBps = (shortRate - longRate) * 10_000;
        if (fundingEdgeBps < this.cfg.minFundingEdgeBps) {
          this.resetAlive(this.makeId(symbol, long.exchange, short.exchange));
          this.oppsById.delete(this.makeId(symbol, long.exchange, short.exchange));
          continue;
        }

        const longPrice = long.askPrice;
        const shortPrice = short.bidPrice;
        const mid = (longPrice + shortPrice) / 2;
        const entryCostBps = Math.max(0, ((longPrice - shortPrice) / mid) * 10_000);
        if (entryCostBps > fundingEdgeBps) {
          this.resetAlive(this.makeId(symbol, long.exchange, short.exchange));
          this.oppsById.delete(this.makeId(symbol, long.exchange, short.exchange));
          continue;
        }

        const id = this.makeId(symbol, long.exchange, short.exchange);
        const timeAliveMs = this.getTimeAlive(id, now);
        if (timeAliveMs < this.cfg.minTimeAliveMs) continue;

        const opp: FundingOpportunity = {
          id,
          symbol,
          longExchange: long.exchange,
          shortExchange: short.exchange,
          longPrice,
          shortPrice,
          longFundingRate: longRate,
          longNextFundingTime: longF.nextFundingTime,
          shortFundingRate: shortRate,
          shortNextFundingTime: shortF.nextFundingTime,
          fundingEdgeBps,
          entryCostBps,
          longTopQty: long.askQty,
          shortTopQty: short.bidQty,
          observedAt: now,
          timeAliveMs
        };

        this.oppsById.set(id, opp);
      }
    }
  }

  private makeId(symbol: CanonicalSymbol, longEx: ExchangeId, shortEx: ExchangeId) {
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
