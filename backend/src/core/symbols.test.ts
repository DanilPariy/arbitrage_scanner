import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBinanceUsdMPerpSymbol,
  parseBitgetPerpSymbol,
  parseBybitPerpSymbol,
  parseOkxPerpSymbol
} from "./symbols.js";

test("parses a Binance USDT perpetual symbol", () => {
  assert.deepEqual(parseBinanceUsdMPerpSymbol("BTCUSDT"), {
    base: "BTC",
    quote: "USDT",
    kind: "PERP",
    canonical: "BTC-USDT-PERP"
  });
});

test("Binance parsing is case-insensitive and trims whitespace", () => {
  assert.equal(parseBinanceUsdMPerpSymbol("  ethusdc  ")?.canonical, "ETH-USDC-PERP");
});

test("rejects a Binance symbol with no known quote suffix", () => {
  assert.equal(parseBinanceUsdMPerpSymbol("BTCXYZ"), null);
});

test("applies the canonical symbol blacklist", () => {
  assert.equal(parseBinanceUsdMPerpSymbol("FUNUSDT"), null);
});

test("parses an OKX swap symbol", () => {
  assert.equal(parseOkxPerpSymbol("SOL-USDT-SWAP")?.canonical, "SOL-USDT-PERP");
});

test("rejects non-swap OKX instruments", () => {
  assert.equal(parseOkxPerpSymbol("SOL-USDT-FUTURES"), null);
});

test("Bybit reuses suffix-based perpetual parsing", () => {
  assert.equal(parseBybitPerpSymbol("ETHUSDT")?.canonical, "ETH-USDT-PERP");
});

test("Bitget strips its contract suffix before normalization", () => {
  assert.equal(parseBitgetPerpSymbol("BTCUSDT_UMCBL")?.canonical, "BTC-USDT-PERP");
});
