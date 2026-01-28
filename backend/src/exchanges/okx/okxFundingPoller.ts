import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import type { SymbolRegistry } from "../../core/symbolRegistry.js";
import type { LoggerLike } from "../../core/symbolRegistry.js";
import { FundingPoller } from "../../core/fundingPoller.js";
import { fetchOkxFunding } from "./okxFunding.js";

export type OkxFundingPollerConfig = {
  restBaseUrl: string; // https://www.okx.com
  normalPollMs: number;
  nearFundingMs: number;
  nearPollMs: number;
};

export class OkxFundingPoller extends FundingPoller {
  private restBaseUrl: string;

  constructor(
    bus: TypedBus<AppEvents>,
    symbols: SymbolRegistry,
    log: LoggerLike,
    cfg: OkxFundingPollerConfig
  ) {
    super(bus, symbols, log, {
      exchange: "okx",
      normalPollMs: cfg.normalPollMs,
      nearFundingMs: cfg.nearFundingMs,
      nearPollMs: cfg.nearPollMs
    });

    this.restBaseUrl = cfg.restBaseUrl;
  }

  protected fetchFunding(exchangeSymbol: string) {
    return fetchOkxFunding(this.restBaseUrl, exchangeSymbol);
  }
}
