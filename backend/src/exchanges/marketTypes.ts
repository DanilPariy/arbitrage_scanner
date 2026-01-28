import type { ExchangeId } from "../../../shared/types.js";
import type { CanonicalSymbol } from "../core/symbols.js";

export type TopOfBook = {
  exchange: ExchangeId;

  // NEW:
  symbol: CanonicalSymbol;      // normalized, used by engine/state
  exchangeSymbol: string;       // raw exchange symbol (for debugging / UI)

  bidPrice: number;
  bidQty: number;
  askPrice: number;
  askQty: number;
  ts: number;
};
