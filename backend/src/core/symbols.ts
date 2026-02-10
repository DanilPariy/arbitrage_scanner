import { SYMBOL_BLACKLIST } from "../config/symbolBlacklist.js";

export type CanonicalSymbol = `${string}-${string}-PERP`;

export type ParsedSymbol = {
  base: string;
  quote: string;
  kind: "PERP";
  canonical: CanonicalSymbol;
};

// Quotes we care about for perps. Order matters: longest first.
const KNOWN_QUOTES = [
  "USDT",
  "USDC",
  "FDUSD",
  "TUSD",
  "BUSD",
  "USD"
] as const;

function makeCanonical(base: string, quote: string): CanonicalSymbol {
  return `${base}-${quote}-PERP`;
}

function isBlacklisted(canonical: CanonicalSymbol): boolean {
  return SYMBOL_BLACKLIST.has(canonical);
}

/**
 * Binance USD-M futures perps typically send symbols like "BTCUSDT".
 * We split by known quote suffix.
 */
export function parseBinanceUsdMPerpSymbol(exchangeSymbol: string): ParsedSymbol | null {
  const s = exchangeSymbol.toUpperCase().trim();

  for (const q of KNOWN_QUOTES) {
    if (s.endsWith(q) && s.length > q.length) {
      const base = s.slice(0, -q.length);
      const quote = q;
      const canonical = makeCanonical(base, quote);
      if (isBlacklisted(canonical)) return null;
      return { base, quote, kind: "PERP", canonical };
    }
  }

  return null;
}

/**
 * OKX perps look like: "BTC-USDT-SWAP"
 */
export function parseOkxPerpSymbol(exchangeSymbol: string): ParsedSymbol | null {
  const s = exchangeSymbol.toUpperCase().trim();
  const parts = s.split("-");

  if (parts.length !== 3) return null;
  if (parts[2] !== "SWAP") return null;

  const base = parts[0];
  const quote = parts[1];
  if (!base || !quote) return null; // extra safety

  const canonical = makeCanonical(base, quote);
  if (isBlacklisted(canonical)) return null;
  return { base, quote, kind: "PERP", canonical };
}

/**
 * Bybit perps commonly appear as:
 * - linear USDT: "BTCUSDT"
 * - inverse: "BTCUSD" (we treat quote USD)
 * This parser handles suffix split like Binance.
 */
export function parseBybitPerpSymbol(exchangeSymbol: string): ParsedSymbol | null {
  // same suffix logic works for common linear symbols
  return parseBinanceUsdMPerpSymbol(exchangeSymbol);
}

/**
 * Bitget perps appear as:
 * - linear USDT: "BTCUSDT"
 * - mix/contract: "BTCUSDT_UMCBL"
 * Strip any suffix and reuse suffix parsing.
 */
export function parseBitgetPerpSymbol(exchangeSymbol: string): ParsedSymbol | null {
  const s = exchangeSymbol.toUpperCase().trim();
  const basePart = s.split("_")[0] ?? s;
  return parseBinanceUsdMPerpSymbol(basePart);
}
