import test from "node:test";
import assert from "node:assert/strict";
import { estimateRoundTripFeesBps, takerFeeBps } from "./fees.js";

test("round-trip fees sum both exchange taker fees", () => {
  assert.equal(
    estimateRoundTripFeesBps("binance", "okx"),
    takerFeeBps.binance + takerFeeBps.okx
  );
});

test("fee calculation is directional only through the selected exchanges", () => {
  assert.equal(
    estimateRoundTripFeesBps("bitget", "bybit"),
    takerFeeBps.bitget + takerFeeBps.bybit
  );
});
