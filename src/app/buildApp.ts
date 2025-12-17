import Fastify, { type FastifyInstance } from "fastify";
import type { LoggerOptions } from "pino";
import { env } from "../config/env.js";
import { registerRoutes } from "../api/routes.js";
import { buildContext, type AppContext } from "./context.js";
import cors from "@fastify/cors";

declare module "fastify" {
  interface FastifyInstance {
    ctx: AppContext;
  }
}

export async function buildApp(): Promise<FastifyInstance> {
  const isDev = env.NODE_ENV === "development";

  const logger: LoggerOptions = isDev
    ? {
        level: "debug",
        transport: { target: "pino-pretty", options: { colorize: true } }
      }
    : { level: "info" };

  const app = Fastify({ logger });
  await app.register(cors, {
    origin: true,          // allow all origins (fine for dev)
    credentials: true
  });

  // attach shared context (bus, stores, later exchange registry, engine, etc.)
  app.decorate("ctx", buildContext());
  app.ctx.symbols.setLogger(app.log);
  app.ctx.bus.on("market:top", (top) => {
    app.ctx.symbols.observeTop(top);
  });

  registerRoutes(app);


  return app;
}
