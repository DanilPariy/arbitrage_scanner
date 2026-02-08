import type { PerpOpportunity, FundingOpportunity } from "../../../shared/types.js";
import type { ExchangeId } from "../../../shared/types.js";
import type { CanonicalSymbol } from "../core/symbols.js";
import type { TopOfBook } from "../exchanges/marketTypes.js";

export type AppEvents = {
  "opps:update": {
    top: PerpOpportunity[];
    updatedAt: number;
  };

  "funding:opps": {
    top: FundingOpportunity[];
    updatedAt: number;
  };

  "market:top": TopOfBook;

  "funding:update": {
    exchange: ExchangeId;
    symbol: CanonicalSymbol;
    exchangeSymbol: string;
    rate: number; // decimal, e.g. 0.0001
    nextFundingTime: number; // epoch ms
    ts: number; // emitted-at timestamp
  };
};
