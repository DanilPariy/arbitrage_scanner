import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import type { SymbolRegistry, LoggerLike } from "../../core/symbolRegistry.js";
import { FundingPoller } from "../../core/fundingPoller.js";
import { fetchBitgetFunding } from "./bitgetFunding.js";

export type BitgetFundingPollerConfig = {
  restBaseUrl: string; // https://api.bitget.com
  productType: string; // e.g. USDT-FUTURES
  normalPollMs: number;
  nearFundingMs: number;
  nearPollMs: number;
};

export class BitgetFundingPoller extends FundingPoller {
  private restBaseUrl: string;
  private productType: string;

  constructor(
    bus: TypedBus<AppEvents>,
    symbols: SymbolRegistry,
    log: LoggerLike,
    cfg: BitgetFundingPollerConfig
  ) {
    super(bus, symbols, log, {
      exchange: "bitget",
      normalPollMs: cfg.normalPollMs,
      nearFundingMs: cfg.nearFundingMs,
      nearPollMs: cfg.nearPollMs
    });

    this.restBaseUrl = cfg.restBaseUrl;
    this.productType = cfg.productType;
  }

  protected fetchFunding(exchangeSymbol: string) {
    return fetchBitgetFunding(this.restBaseUrl, exchangeSymbol, this.productType);
  }
}
