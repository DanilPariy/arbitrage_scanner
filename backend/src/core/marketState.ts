import type { ExchangeId } from "../../../shared/types.js";
import type { TopOfBook } from "../exchanges/marketTypes.js";
import type { CanonicalSymbol } from "./symbols.js";

export class MarketState {
  // Map<canonicalSymbol, Map<exchange, TopOfBook>>
  private bySymbol = new Map<CanonicalSymbol, Map<ExchangeId, TopOfBook>>();

  upsertTop(top: TopOfBook) {
    let m = this.bySymbol.get(top.symbol);
    if (!m) {
      m = new Map();
      this.bySymbol.set(top.symbol, m);
    }
    m.set(top.exchange, top);
  }

  getTopsForSymbol(symbol: CanonicalSymbol): TopOfBook[] {
    const m = this.bySymbol.get(symbol);
    return m ? Array.from(m.values()) : [];
  }
}
