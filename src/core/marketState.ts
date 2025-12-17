import type { ExchangeId } from "./types.js";
import type { TopOfBook } from "../exchanges/marketTypes.js";

type ExSymKey = `${ExchangeId}::${string}`;

export class MarketState {
  // store latest quote by exchange+symbol
  private tops = new Map<ExSymKey, TopOfBook>();

  upsertTop(top: TopOfBook) {
    const key: ExSymKey = `${top.exchange}::${top.symbol}`;
    this.tops.set(key, top);
  }

  getTop(exchange: ExchangeId, symbol: string): TopOfBook | undefined {
    const key: ExSymKey = `${exchange}::${symbol}`;
    return this.tops.get(key);
  }

  // return all exchanges that currently have a top-of-book for this symbol
  getTopsForSymbol(symbol: string): TopOfBook[] {
    const out: TopOfBook[] = [];
    for (const v of this.tops.values()) {
      if (v.symbol === symbol) out.push(v);
    }
    return out;
  }
}
