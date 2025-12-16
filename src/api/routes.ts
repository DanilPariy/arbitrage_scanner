import type { FastifyInstance } from "fastify";

function sseWrite(res: NodeJS.WritableStream, event: string, data: unknown) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

export function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { ok: true };
  });

  app.get("/stream/opps", async (req, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");

    // Optional but helpful with some proxies:
    // reply.raw.setHeader("X-Accel-Buffering", "no");

    // Send current snapshot immediately
    const snap = app.ctx.opps.getSnapshot();
    sseWrite(reply.raw, "snapshot", snap);

    // Subscribe to updates
    const unsubscribe = app.ctx.bus.on("opps:update", (payload) => {
      sseWrite(reply.raw, "opps", payload);
    });

    // Heartbeat keeps connection alive through some proxies
    const heartbeat = setInterval(() => {
      sseWrite(reply.raw, "ping", { t: Date.now() });
    }, 15_000);

    req.raw.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });
}
