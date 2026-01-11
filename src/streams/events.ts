import type { PerpOpportunity } from "../core/types.js";
import type { ExchangeId } from "../core/types.js";
import type { CanonicalSymbol } from "../core/symbols.js";
import type { TopOfBook } from "../exchanges/marketTypes.js";

export type AppEvents = {
  "opps:update": {
    top: PerpOpportunity[];
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
