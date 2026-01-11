import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import type { SymbolRegistry, LoggerLike } from "../../core/symbolRegistry.js";
import { FundingPoller } from "../../core/fundingPoller.js";
import { fetchBybitFunding } from "./bybitFunding.js";

export type BybitFundingPollerConfig = {
  restBaseUrl: string; // https://api.bybit.com
  normalPollMs: number;
  nearFundingMs: number;
  nearPollMs: number;
};

export class BybitFundingPoller extends FundingPoller {
  private restBaseUrl: string;

  constructor(
    bus: TypedBus<AppEvents>,
    symbols: SymbolRegistry,
    log: LoggerLike,
    cfg: BybitFundingPollerConfig
  ) {
    super(bus, symbols, log, {
      exchange: "bybit",
      normalPollMs: cfg.normalPollMs,
      nearFundingMs: cfg.nearFundingMs,
      nearPollMs: cfg.nearPollMs
    });

    this.restBaseUrl = cfg.restBaseUrl;
  }

  protected fetchFunding(exchangeSymbol: string) {
    return fetchBybitFunding(this.restBaseUrl, exchangeSymbol);
  }
}
