import { buildApp } from "./app/buildApp.js";
import { env } from "./config/env.js";

const app = buildApp();

app.listen({ port: env.PORT, host: env.HOST })
  .then((address) => {
    app.log.info(`listening on ${address}`);
  })
  .catch((err) => {
    app.log.error(err, "failed to start");
    process.exit(1);
  });
