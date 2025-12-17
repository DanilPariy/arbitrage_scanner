import { buildApp } from "./app/buildApp.js";
import { env } from "./config/env.js";
import { BinancePerpConnector } from "./exchanges/binance/binancePerpConnector.js";
import { ArbEngine } from "./core/arbEngine.js";

const app = buildApp();

// start connectors
const binance = new BinancePerpConnector();
await binance.start(app.ctx.bus);

// start arb engine
const engine = new ArbEngine(app.ctx.bus, {
  minNetEdgeBps: 5,
  minTimeAliveMs: 1500,
  minTopQty: 1,
  maxOpps: 25,

  publishIntervalMs: 300, // ~3.3 updates/sec (nice for UI)
  staleOppMs: 5000        // drop opp if not refreshed for 5s
});
engine.start();

app.listen({ port: env.PORT, host: env.HOST })
  .then((address) => app.log.info(`listening on ${address}`))
  .catch((err) => {
    app.log.error(err, "failed to start");
    process.exit(1);
  });
