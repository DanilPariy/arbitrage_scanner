import { buildApp } from "./app/buildApp.js";
import { startMarketServices } from "./app/startMarketServices.js";
import { env } from "./config/env.js";

const app = await buildApp();
await startMarketServices(app);

try {
  const address = await app.listen({ port: env.PORT, host: env.HOST });
  app.log.info(`listening on ${address}`);
} catch (err) {
  app.log.error(err, "failed to start");
  process.exit(1);
}
