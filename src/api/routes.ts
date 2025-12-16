import type { FastifyInstance } from "fastify";

export function registerRoutes(app: FastifyInstance) {
  app.get("/health", async () => {
    return { ok: true };
  });

  // SSE placeholder: later we’ll stream top arb opportunities here
  app.get("/stream/opps", async (req, reply) => {
    reply.raw.setHeader("Content-Type", "text/event-stream");
    reply.raw.setHeader("Cache-Control", "no-cache, no-transform");
    reply.raw.setHeader("Connection", "keep-alive");

    // Initial message so client knows it's connected
    reply.raw.write(`event: hello\ndata: ${JSON.stringify({ ok: true })}\n\n`);

    const interval = setInterval(() => {
      // later: push real opportunities
      reply.raw.write(`event: tick\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`);
    }, 1000);

    req.raw.on("close", () => {
      clearInterval(interval);
    });
  });
}
