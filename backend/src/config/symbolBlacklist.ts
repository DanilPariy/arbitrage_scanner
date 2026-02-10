import type { CanonicalSymbol } from "../core/symbols.js";

// Canonical symbols to exclude from scanning/trading due to ambiguity.
// Example: ["FUN-USDT-PERP"]
export const SYMBOL_BLACKLIST = new Set<CanonicalSymbol>([
    "FUN-USDT-PERP"
    , "FUNTOKEN-USDT-PERP"
]);
