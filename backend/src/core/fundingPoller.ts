import type { TypedBus } from "../streams/bus.js";
import type { AppEvents } from "../streams/events.js";
import type { ExchangeId, PerpOpportunity } from "../../../shared/types.js";
import type { CanonicalSymbol } from "./symbols.js";
import type { SymbolRegistry, LoggerLike } from "./symbolRegistry.js";
import { sleep } from "./sleep.js";

type WatchItem = { exchange: ExchangeId; symbol: CanonicalSymbol };

export type FundingPollerConfig = {
  exchange: ExchangeId;
  normalPollMs: number;    // 60_000
  nearFundingMs: number;   // 10 * 60_000
  nearPollMs: number;      // 10_000
};

export abstract class FundingPoller {
  private wanted = new Map<string, WatchItem>(); // key = ex::symbol
  private running = false;

  constructor(
    protected bus: TypedBus<AppEvents>,
    protected symbols: SymbolRegistry,
    protected log: LoggerLike,
    protected cfg: FundingPollerConfig
  ) {}

  start() {
    this.bus.on("opps:update", ({ top }) => {
      this.refreshWanted(top);
    });

    this.running = true;
    void this.loop();
  }

  stop() {
    this.running = false;
  }

  protected abstract fetchFunding(exchangeSymbol: string): Promise<{ rate: number; nextFundingTime: number }>;

  private refreshWanted(top: PerpOpportunity[]) {
    for (const opp of top) {
      const sym = opp.symbol as CanonicalSymbol;

      if (opp.longExchange === this.cfg.exchange) {
        this.wanted.set(`${opp.longExchange}::${sym}`, { exchange: this.cfg.exchange, symbol: sym });
      }
      if (opp.shortExchange === this.cfg.exchange) {
        this.wanted.set(`${opp.shortExchange}::${sym}`, { exchange: this.cfg.exchange, symbol: sym });
      }
    }
  }

  private async loop() {
    while (this.running) {
      const now = Date.now();

      for (const item of this.wanted.values()) {
        try {
          const next = this.symbols.getExchangeSymbol(this.cfg.exchange, item.symbol)
            ? this.lastNextFundingTime(item.symbol)
            : Infinity;
          const isNear = Number.isFinite(next) && next - now <= this.cfg.nearFundingMs;

          const minAge = isNear ? this.cfg.nearPollMs : this.cfg.normalPollMs;
          const updatedAt = this.lastUpdatedAt(item.symbol);
          if (now - updatedAt < minAge) continue;

          await this.fetchAndEmit(item.symbol);
          await sleep(50);
        } catch (e) {
          this.log.warn({ err: String(e), item }, "funding fetch failed");
        }
      }

      await sleep(500);
    }
  }

  private lastUpdatedAt(symbol: CanonicalSymbol): number {
    // Track in-memory by subscribing to bus; simple internal cache via events.
    return this.cache.get(symbol)?.updatedAt ?? 0;
  }

  private lastNextFundingTime(symbol: CanonicalSymbol): number {
    return this.cache.get(symbol)?.nextFundingTime ?? Infinity;
  }

  private cache = new Map<CanonicalSymbol, { updatedAt: number; nextFundingTime: number }>();

  private async fetchAndEmit(symbol: CanonicalSymbol) {
    const exchangeSymbol = this.symbols.getExchangeSymbol(this.cfg.exchange, symbol);
    if (!exchangeSymbol) return;

    const { rate, nextFundingTime } = await this.fetchFunding(exchangeSymbol);
    if (!Number.isFinite(rate) || !Number.isFinite(nextFundingTime)) return;

    const ts = Date.now();
    this.cache.set(symbol, { updatedAt: ts, nextFundingTime });

    this.bus.emit("funding:update", {
      exchange: this.cfg.exchange,
      symbol,
      exchangeSymbol,
      rate,
      nextFundingTime,
      ts
    });
  }
}
