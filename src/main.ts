import { buildApp } from "./app/buildApp.js";
import { env } from "./config/env.js";
import { BinancePerpConnector } from "./exchanges/binance/binancePerpConnector.js";

const app = buildApp();

const binance = new BinancePerpConnector();
await binance.start(app.ctx.bus);

// quick visibility: log a few top-of-book updates
let count = 0;
const off = app.ctx.bus.on("market:top", (top) => {
  if (count++ < 5) app.log.info({ top }, "market:top");
  if (count === 5) off();
});

app.listen({ port: env.PORT, host: env.HOST })
  .then((address) => app.log.info(`listening on ${address}`))
  .catch((err) => {
    app.log.error(err, "failed to start");
    process.exit(1);
  });
