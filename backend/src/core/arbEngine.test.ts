import test from "node:test";
import assert from "node:assert/strict";
import type { ExchangeId } from "../../../shared/types.js";
import { ArbEngine } from "./arbEngine.js";
import { FundingStore } from "./fundingStore.js";
import type { CanonicalSymbol } from "./symbols.js";
import type { TopOfBook } from "../exchanges/marketTypes.js";
import { TypedBus } from "../streams/bus.js";
import type { AppEvents } from "../streams/events.js";

const DEFAULT_SYMBOL = "BTC-USDT-PERP" as CanonicalSymbol;

function top(
  exchange: ExchangeId,
  {
    symbol = DEFAULT_SYMBOL,
    bidPrice,
    askPrice,
    bidQty = 10,
    askQty = 10,
    ts = Date.now()
  }: {
    symbol?: CanonicalSymbol;
    bidPrice: number;
    askPrice: number;
    bidQty?: number;
    askQty?: number;
    ts?: number;
  }
): TopOfBook {
  return {
    exchange,
    symbol,
    exchangeSymbol: symbol.replace("-PERP", "").replaceAll("-", ""),
    bidPrice,
    bidQty,
    askPrice,
    askQty,
    ts
  };
}

function nextUpdate(bus: TypedBus<AppEvents>) {
  return new Promise<AppEvents["opps:update"]>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out waiting for opps:update")), 500);
    const off = bus.on("opps:update", (payload) => {
      clearTimeout(timer);
      off();
      resolve(payload);
    });
  });
}

function makeEngine(bus: TypedBus<AppEvents>, funding?: FundingStore, maxOpps = 10) {
  return new ArbEngine(
    bus,
    {
      minNetEdgeBps: 0,
      minTimeAliveMs: 0,
      minTopQty: 1,
      maxOpps,
      publishIntervalMs: 1,
      staleOppMs: 10_000
    },
    funding
  );
}

test("publishes a profitable cross-exchange opportunity", async () => {
  const bus = new TypedBus<AppEvents>();
  const stop = makeEngine(bus).start();
  const update = nextUpdate(bus);

  bus.emit("market:top", top("binance", { bidPrice: 99.9, askPrice: 100 }));
  bus.emit("market:top", top("okx", { bidPrice: 101, askPrice: 101.1 }));

  const payload = await update;
  assert.equal(payload.top.length, 1);
  assert.equal(payload.top[0]?.longExchange, "binance");
  assert.equal(payload.top[0]?.shortExchange, "okx");
  assert.equal(payload.top[0]?.symbol, DEFAULT_SYMBOL);
  assert.ok((payload.top[0]?.netEdgeBps ?? 0) > 0);

  stop();
  bus.clear();
});

test("filters opportunities that fail the minimum top-of-book quantity", async () => {
  const bus = new TypedBus<AppEvents>();
  const stop = makeEngine(bus).start();
  const update = nextUpdate(bus);

  bus.emit("market:top", top("binance", { bidPrice: 99.9, askPrice: 100, askQty: 0.25 }));
  bus.emit("market:top", top("okx", { bidPrice: 101, askPrice: 101.1 }));

  const payload = await update;
  assert.deepEqual(payload.top, []);

  stop();
  bus.clear();
});

test("keeps only the configured global top-N opportunities", async () => {
  const bus = new TypedBus<AppEvents>();
  const stop = makeEngine(bus, undefined, 1).start();
  const update = nextUpdate(bus);

  bus.emit(
    "market:top",
    top("binance", {
      symbol: "BTC-USDT-PERP",
      bidPrice: 99.9,
      askPrice: 100
    })
  );
  bus.emit(
    "market:top",
    top("okx", {
      symbol: "BTC-USDT-PERP",
      bidPrice: 100.7,
      askPrice: 100.8
    })
  );

  bus.emit(
    "market:top",
    top("binance", {
      symbol: "ETH-USDT-PERP",
      bidPrice: 199.8,
      askPrice: 200
    })
  );
  bus.emit(
    "market:top",
    top("okx", {
      symbol: "ETH-USDT-PERP",
      bidPrice: 203,
      askPrice: 203.2
    })
  );

  const payload = await update;
  assert.equal(payload.top.length, 1);
  assert.equal(payload.top[0]?.symbol, "ETH-USDT-PERP");

  stop();
  bus.clear();
});

test("includes the next funding impact when both legs have funding data", async () => {
  const bus = new TypedBus<AppEvents>();
  const funding = new FundingStore();
  const nextFundingTime = Date.now() + 60_000;

  funding.set("binance", DEFAULT_SYMBOL, {
    rate: 0.0001,
    nextFundingTime,
    updatedAt: Date.now()
  });
  funding.set("okx", DEFAULT_SYMBOL, {
    rate: 0.0003,
    nextFundingTime,
    updatedAt: Date.now()
  });

  const stop = makeEngine(bus, funding).start();
  const update = nextUpdate(bus);

  bus.emit("market:top", top("binance", { bidPrice: 99.9, askPrice: 100 }));
  bus.emit("market:top", top("okx", { bidPrice: 101, askPrice: 101.1 }));

  const payload = await update;
  const opp = payload.top[0];
  assert.ok(opp);
  assert.equal(opp.longFundingRate, 0.0001);
  assert.equal(opp.shortFundingRate, 0.0003);
  assert.ok(opp.netAfterFundingBps !== null);
  assert.ok(Math.abs((opp.netAfterFundingBps ?? 0) - (opp.netEdgeBps + 2)) < 1e-9);

  stop();
  bus.clear();
});
