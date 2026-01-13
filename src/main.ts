import { buildApp } from "./app/buildApp.js";
import { env } from "./config/env.js";
import { BinancePerpConnector } from "./exchanges/binance/binancePerpConnector.js";
import { ArbEngine } from "./core/arbEngine.js";
import { OkxPerpManager } from "./exchanges/okx/okxPerpManager.js";
import { FundingTracker } from "./core/fundingTracker.js";
import { BinanceFundingPoller } from "./exchanges/binance/binanceFundingPoller.js";
import { OkxFundingPoller } from "./exchanges/okx/okxFundingPoller.js";
import { BybitPerpManager } from "./exchanges/bybit/bybitPerpManager.js";
import { BybitFundingPoller } from "./exchanges/bybit/bybitFundingPoller.js";
import { BitgetPerpManager } from "./exchanges/bitget/bitgetPerpManager.js";
import { BitgetFundingPoller } from "./exchanges/bitget/bitgetFundingPoller.js";

const app = await buildApp();

// start connectors
const binance = new BinancePerpConnector();
await binance.start(app.ctx.bus);

const okxMgr = new OkxPerpManager({
  restBaseUrl: "https://www.okx.com",
  wsUrl: env.OKX_WS_URL,
  quote: "USDT",

  minVolCcy24h: 1_000_000,
  maxInstruments: 800,

  maxWsConnections: 4,
  perConnectionInstruments: 200,

  subscribeChunkSize: 100,
  subscribeDelayMs: 350
});
await okxMgr.start(app.ctx.bus);

const bybitMgr = new BybitPerpManager({
  restBaseUrl: env.BYBIT_REST_BASE_URL,
  wsUrl: env.BYBIT_WS_URL,
  quote: "USDT",

  minTurnover24h: 1_000_000,
  maxInstruments: 800,

  maxWsConnections: 4,
  perConnectionInstruments: 200,

  subscribeChunkSize: 100,
  subscribeDelayMs: 350
});
await bybitMgr.start(app.ctx.bus);

const bitgetMgr = new BitgetPerpManager({
  restBaseUrl: env.BITGET_REST_BASE_URL,
  wsUrl: env.BITGET_WS_URL,
  quote: "USDT",
  productType: "USDT-FUTURES",

  minTurnover24h: 1_000_000,
  maxInstruments: 800,

  maxWsConnections: 4,
  perConnectionInstruments: 200,

  subscribeChunkSize: 100,
  subscribeDelayMs: 350
});
await bitgetMgr.start(app.ctx.bus);

const fundingTracker = new FundingTracker(app.ctx.bus, app.log);
fundingTracker.start();

const binanceFunding = new BinanceFundingPoller(app.ctx.bus, app.ctx.symbols, app.log, {
  restBaseUrl: "https://fapi.binance.com",
  normalPollMs: 60_000,
  nearFundingMs: 10 * 60_000,
  nearPollMs: 10_000
});
binanceFunding.start();

const okxFunding = new OkxFundingPoller(app.ctx.bus, app.ctx.symbols, app.log, {
  restBaseUrl: "https://www.okx.com",
  normalPollMs: 60_000,
  nearFundingMs: 10 * 60_000,
  nearPollMs: 10_000
});
okxFunding.start();

const bybitFunding = new BybitFundingPoller(app.ctx.bus, app.ctx.symbols, app.log, {
  restBaseUrl: env.BYBIT_REST_BASE_URL,
  normalPollMs: 60_000,
  nearFundingMs: 10 * 60_000,
  nearPollMs: 10_000
});
bybitFunding.start();

const bitgetFunding = new BitgetFundingPoller(app.ctx.bus, app.ctx.symbols, app.log, {
  restBaseUrl: env.BITGET_REST_BASE_URL,
  productType: "USDT-FUTURES",
  normalPollMs: 60_000,
  nearFundingMs: 10 * 60_000,
  nearPollMs: 10_000
});
bitgetFunding.start();

// start arb engine
const engine = new ArbEngine(app.ctx.bus, {
  minNetEdgeBps: 5,
  minTimeAliveMs: 1500,
  minTopQty: 1,
  maxOpps: 25,

  publishIntervalMs: 300, // ~3.3 updates/sec (nice for UI)
  staleOppMs: 5000        // drop opp if not refreshed for 5s
}, fundingTracker.getStore());
engine.start();

app.listen({ port: env.PORT, host: env.HOST })
  .then((address) => app.log.info(`listening on ${address}`))
  .catch((err) => {
    app.log.error(err, "failed to start");
    process.exit(1);
  });
