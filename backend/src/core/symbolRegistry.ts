import type { ExchangeId } from "../../../shared/types.js";
import type { CanonicalSymbol } from "./symbols.js";
import type { TopOfBook } from "../exchanges/marketTypes.js";

export type LoggerLike = {
  info: (obj: unknown, msg?: string) => void;
  warn: (obj: unknown, msg?: string) => void;
  error?: (obj: unknown, msg?: string) => void;
};

type CanonicalKey = CanonicalSymbol;
type ExchangeSymbol = string;

export class SymbolRegistry {
  // canonical -> exchange -> exchangeSymbol
  private byCanonical = new Map<CanonicalKey, Map<ExchangeId, ExchangeSymbol>>();

  // exchange -> exchangeSymbol -> canonical
  private byExchangeSymbol = new Map<ExchangeId, Map<ExchangeSymbol, CanonicalKey>>();

  private log: LoggerLike | null = null;

  setLogger(log: LoggerLike) {
    this.log = log;
  }

  /**
   * Register mapping derived from an emitted TopOfBook.
   * We assume TopOfBook already carries:
   * - symbol: CanonicalSymbol
   * - exchangeSymbol: raw exchange symbol
   */
  observeTop(top: TopOfBook) {
    const ex = top.exchange;
    const canonical = top.symbol;
    const raw = top.exchangeSymbol;

    // ---------- exchangeSymbol -> canonical (per exchange) ----------
    let exMap = this.byExchangeSymbol.get(ex);
    if (!exMap) {
      exMap = new Map();
      this.byExchangeSymbol.set(ex, exMap);
    }

    const prevCanonical = exMap.get(raw);
    if (prevCanonical !== undefined && prevCanonical !== canonical) {
      // Same raw symbol on the same exchange mapped to different canonical => bug in parser/normalizer.
      this.log?.warn(
        { exchange: ex, exchangeSymbol: raw, prevCanonical, canonical },
        "symbol mismatch: exchangeSymbol maps to multiple canonical symbols"
      );
    } else {
      exMap.set(raw, canonical);
    }

    // ---------- canonical -> exchangeSymbol (per canonical) ----------
    let canMap = this.byCanonical.get(canonical);
    if (!canMap) {
      canMap = new Map();
      this.byCanonical.set(canonical, canMap);
    }

    const prevRaw = canMap.get(ex);
    if (prevRaw !== undefined && prevRaw !== raw) {
      // Same canonical on same exchange observed with different raw names => usually subscription mix-up or bad normalization.
      this.log?.warn(
        { exchange: ex, canonical, prevExchangeSymbol: prevRaw, exchangeSymbol: raw },
        "symbol mismatch: canonical maps to multiple exchangeSymbols for same exchange"
      );
    } else {
      canMap.set(ex, raw);
    }
  }

  /** How many exchanges currently support this canonical symbol */
  countExchanges(canonical: CanonicalSymbol): number {
    const m = this.byCanonical.get(canonical);
    return m ? m.size : 0;
  }

  /** Returns exchanges that have been observed for this canonical symbol */
  getExchanges(canonical: CanonicalSymbol): ExchangeId[] {
    const m = this.byCanonical.get(canonical);
    return m ? Array.from(m.keys()) : [];
  }

  /** Returns raw exchange symbol for a canonical on a given exchange (for UI/debug) */
  getExchangeSymbol(exchange: ExchangeId, canonical: CanonicalSymbol): string | undefined {
    const m = this.byCanonical.get(canonical);
    return m?.get(exchange);
  }

  /** Returns canonicals that exist on at least N exchanges (useful filter for arb universe) */
  getCanonicalsMinExchanges(min: number): CanonicalSymbol[] {
    const out: CanonicalSymbol[] = [];
    for (const [canonical, m] of this.byCanonical.entries()) {
      if (m.size >= min) out.push(canonical);
    }
    return out;
  }
}
