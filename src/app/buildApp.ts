import Fastify, { type FastifyInstance } from "fastify";
import type { LoggerOptions } from "pino";
import { env } from "../config/env.js";
import { registerRoutes } from "../api/routes.js";

export function buildApp(): FastifyInstance {
  const isDev = env.NODE_ENV === "development";

  const logger: LoggerOptions = isDev
    ? {
        level: "debug",
        transport: {
          target: "pino-pretty",
          options: { colorize: true }
        }
      }
    : {
        level: "info"
      };

  const app = Fastify({ logger });

  registerRoutes(app);
  return app;
}
