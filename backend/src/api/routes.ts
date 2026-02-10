import type { FastifyInstance } from "fastify";

function sseWrite(res: NodeJS.WritableStream, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { ok: true };
  });

  app.get("/api/opps", async () => {
    const snap = app.ctx.opps.getSnapshot();
    return { schemaVersion: 1, ...snap };
  });

  app.get("/api/funding-opps", async () => {
    const snap = app.ctx.fundingOpps.getSnapshot();
    return { schemaVersion: 1, ...snap };
  });

  app.get("/stream/opps", async (req, reply) => {
    // ✅ CORS — REQUIRED for EventSource
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.setHeader("Access-Control-Allow-Methods", "GET");
    reply.raw.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // SSE headers
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");

    reply.hijack();
    reply.raw.flushHeaders?.();

    // Initial snapshot
    const snap = app.ctx.opps.getSnapshot();
    sseWrite(reply.raw, "snapshot", snap);

    const unsubscribe = app.ctx.bus.on("opps:update", (payload) => {
      sseWrite(reply.raw, "opps", payload);
    });

    const heartbeat = setInterval(() => {
      sseWrite(reply.raw, "ping", { t: Date.now() });
    }, 15_000);

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.get("/stream/funding-opps", async (req, reply) => {
    // ✅ CORS — REQUIRED for EventSource
    reply.raw.setHeader("Access-Control-Allow-Origin", "*");
    reply.raw.setHeader("Access-Control-Allow-Methods", "GET");
    reply.raw.setHeader("Access-Control-Allow-Headers", "Content-Type");

    // SSE headers
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");

    reply.hijack();
    reply.raw.flushHeaders?.();

    // Initial snapshot
    const snap = app.ctx.fundingOpps.getSnapshot();
    sseWrite(reply.raw, "snapshot", snap);

    const unsubscribe = app.ctx.bus.on("funding:opps", (payload) => {
      sseWrite(reply.raw, "opps", payload);
    });

    const heartbeat = setInterval(() => {
      sseWrite(reply.raw, "ping", { t: Date.now() });
    }, 15_000);

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

}
