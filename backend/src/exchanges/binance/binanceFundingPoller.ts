import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import type { SymbolRegistry } from "../../core/symbolRegistry.js";
import type { LoggerLike } from "../../core/symbolRegistry.js";
import { FundingPoller } from "../../core/fundingPoller.js";
import { fetchBinanceFunding } from "./binanceFunding.js";

export type BinanceFundingPollerConfig = {
  restBaseUrl: string; // https://fapi.binance.com
  normalPollMs: number;
  nearFundingMs: number;
  nearPollMs: number;
};

export class BinanceFundingPoller extends FundingPoller {
  private restBaseUrl: string;

  constructor(
    bus: TypedBus<AppEvents>,
    symbols: SymbolRegistry,
    log: LoggerLike,
    cfg: BinanceFundingPollerConfig
  ) {
    super(bus, symbols, log, {
      exchange: "binance",
      normalPollMs: cfg.normalPollMs,
      nearFundingMs: cfg.nearFundingMs,
      nearPollMs: cfg.nearPollMs
    });

    this.restBaseUrl = cfg.restBaseUrl;
  }

  protected fetchFunding(exchangeSymbol: string) {
    return fetchBinanceFunding(this.restBaseUrl, exchangeSymbol);
  }
}
