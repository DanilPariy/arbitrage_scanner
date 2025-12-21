import { buildApp } from "./app/buildApp.js";
import { env } from "./config/env.js";
import { BinancePerpConnector } from "./exchanges/binance/binancePerpConnector.js";
import { ArbEngine } from "./core/arbEngine.js";
import { OkxPerpManager } from "./exchanges/okx/okxPerpManager.js";
import { FundingMonitor } from "./core/fundingMonitor.js";

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

const funding = new FundingMonitor(app.ctx.bus, app.ctx.symbols, app.log, {
  binanceRestBase: "https://fapi.binance.com",
  okxRestBase: "https://www.okx.com",
  normalPollMs: 60_000,
  nearFundingMs: 10 * 60_000,
  nearPollMs: 10_000
});
funding.start();

// start arb engine
const engine = new ArbEngine(app.ctx.bus, {
  minNetEdgeBps: 5,
  minTimeAliveMs: 1500,
  minTopQty: 1,
  maxOpps: 25,

  publishIntervalMs: 300, // ~3.3 updates/sec (nice for UI)
  staleOppMs: 5000        // drop opp if not refreshed for 5s
}, funding.getStore());
engine.start();

app.listen({ port: env.PORT, host: env.HOST })
  .then((address) => app.log.info(`listening on ${address}`))
  .catch((err) => {
    app.log.error(err, "failed to start");
    process.exit(1);
  });
