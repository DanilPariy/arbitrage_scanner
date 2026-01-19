import type { ExchangeId } from "../../../shared/types.js";
import type { CanonicalSymbol } from "./symbols.js";

export type FundingInfo = {
  rate: number;           // decimal, e.g. 0.0001
  nextFundingTime: number; // epoch ms
  updatedAt: number;      // epoch ms
};

type Key = `${ExchangeId}::${CanonicalSymbol}`;

export class FundingStore {
  private map = new Map<Key, FundingInfo>();

  set(exchange: ExchangeId, symbol: CanonicalSymbol, info: FundingInfo) {
    this.map.set(`${exchange}::${symbol}`, info);
  }

  get(exchange: ExchangeId, symbol: CanonicalSymbol): FundingInfo | undefined {
    return this.map.get(`${exchange}::${symbol}`);
  }
}
