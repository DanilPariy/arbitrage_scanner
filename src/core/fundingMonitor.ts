import type { TypedBus } from "../streams/bus.js";
import type { AppEvents } from "../streams/events.js";
import type { ExchangeId, PerpOpportunity } from "./types.js";
import type { CanonicalSymbol } from "./symbols.js";
import type { SymbolRegistry } from "./symbolRegistry.js";
import { FundingStore } from "./fundingStore.js";
import { sleep } from "./sleep.js";
import { fetchBinanceFunding } from "../exchanges/binance/binanceFunding.js";
import { fetchOkxFunding } from "../exchanges/okx/okxFunding.js";

type LoggerLike = { info: (o: any, m?: string)=>void; warn:(o:any,m?:string)=>void; error:(o:any,m?:string)=>void; };

export type FundingMonitorConfig = {
  binanceRestBase: string; // https://fapi.binance.com
  okxRestBase: string;     // https://www.okx.com
  normalPollMs: number;    // 60_000
  nearFundingMs: number;   // 10 * 60_000
  nearPollMs: number;      // 10_000
};

type WatchItem = { exchange: ExchangeId; symbol: CanonicalSymbol };

export class FundingMonitor {
  private store = new FundingStore();
  private wanted = new Map<string, WatchItem>(); // key = ex::symbol
  private running = false;

  constructor(
    private bus: TypedBus<AppEvents>,
    private symbols: SymbolRegistry,
    private log: LoggerLike,
    private cfg: FundingMonitorConfig
  ) {}

  getStore() {
    return this.store;
  }

  start() {
    // update wanted set when opps change
    this.bus.on("opps:update", ({ top }) => {
      this.refreshWanted(top);
    });

    this.running = true;
    void this.loop();
  }

  stop() {
    this.running = false;
  }

  private refreshWanted(top: PerpOpportunity[]) {
    for (const opp of top) {
      const sym = opp.symbol as CanonicalSymbol;

      this.wanted.set(`${opp.longExchange}::${sym}`, { exchange: opp.longExchange, symbol: sym });
      this.wanted.set(`${opp.shortExchange}::${sym}`, { exchange: opp.shortExchange, symbol: sym });
    }
  }

  private async loop() {
    while (this.running) {
      const now = Date.now();

      for (const item of this.wanted.values()) {
        try {
          const next = this.store.get(item.exchange, item.symbol)?.nextFundingTime ?? Infinity;
          const isNear = Number.isFinite(next) && next - now <= this.cfg.nearFundingMs;

          // simple per-item cadence: if near funding, refresh more often
          const minAge = isNear ? this.cfg.nearPollMs : this.cfg.normalPollMs;
          const updatedAt = this.store.get(item.exchange, item.symbol)?.updatedAt ?? 0;

          if (now - updatedAt < minAge) continue;

          await this.fetchAndStore(item.exchange, item.symbol);
          await sleep(50); // tiny spread to avoid burstiness
        } catch (e) {
          this.log.warn({ err: String(e), item }, "funding fetch failed");
        }
      }

      await sleep(500); // loop tick
    }
  }

  private async fetchAndStore(exchange: ExchangeId, symbol: CanonicalSymbol) {
    const exchangeSymbol = this.symbols.getExchangeSymbol(exchange, symbol);
    if (!exchangeSymbol) return; // not mapped yet

    let rate: number;
    let nextFundingTime: number;

    if (exchange === "binance") {
      ({ rate, nextFundingTime } = await fetchBinanceFunding(this.cfg.binanceRestBase, exchangeSymbol));
    } else if (exchange === "okx") {
      ({ rate, nextFundingTime } = await fetchOkxFunding(this.cfg.okxRestBase, exchangeSymbol));
    } else {
      return; // later: bybit, etc.
    }

    if (!Number.isFinite(rate) || !Number.isFinite(nextFundingTime)) return;

    this.store.set(exchange, symbol, { rate, nextFundingTime, updatedAt: Date.now() });
  }
}
