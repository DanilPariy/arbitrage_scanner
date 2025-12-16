import Fastify, { type FastifyInstance } from "fastify";
import type { LoggerOptions } from "pino";
import { env } from "../config/env.js";
import { registerRoutes } from "../api/routes.js";
import { buildContext, type AppContext } from "./context.js";

declare module "fastify" {
  interface FastifyInstance {
    ctx: AppContext;
  }
}

export function buildApp(): FastifyInstance {
  const isDev = env.NODE_ENV === "development";

  const logger: LoggerOptions = isDev
    ? {
        level: "debug",
        transport: { target: "pino-pretty", options: { colorize: true } }
      }
    : { level: "info" };

  const app = Fastify({ logger });

  // attach shared context (bus, stores, later exchange registry, engine, etc.)
  app.decorate("ctx", buildContext());

  registerRoutes(app);

  return app;
}
