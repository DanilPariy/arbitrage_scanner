import WebSocket from "ws";
import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import { parseOkxPerpSymbol } from "../../core/symbols.js";
import { sleep } from "../../core/sleep.js";
import type { LoggerLike } from "../../core/symbolRegistry.js";

type OkxTickersMsg = {
  arg?: { channel?: string; instId?: string };
  data?: Array<{
    instId?: string;
    bidPx?: string;
    bidSz?: string;
    askPx?: string;
    askSz?: string;
    ts?: string;
  }>;
  event?: string;
  msg?: string;
  code?: string;
};

function toNum(x: unknown): number {
  const n = typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) ? n : NaN;
}

export class OkxPerpConnector {
  private ws: WebSocket | null = null;
  private readonly connId: number;
  private messagesReceived = 0;
  private topsEmitted = 0;
  private lastMessageAt: number | null = null;
  private static nextId = 1;

  constructor(
    private readonly cfg: {
      url: string;
      instIds: string[]; // e.g. ["BTC-USDT-SWAP", "ETH-USDT-SWAP"]
      subscribeChunkSize?: number;
      subscribeDelayMs?: number;
      log?: LoggerLike;
    }
  ) {
    this.connId = OkxPerpConnector.nextId++;
  }

  async start(bus: TypedBus<AppEvents>) {
    // OKX public WS supports subscribe op with args objects: {channel, instId}. :contentReference[oaicite:1]{index=1}
    this.ws = new WebSocket(this.cfg.url);

    this.ws.on("open", async () => {
        this.cfg.log?.info(
          {
            exchange: "okx",
            connId: this.connId,
            url: this.cfg.url,
            symbolsCount: this.cfg.instIds.length,
            subscribeChunkSize: this.cfg.subscribeChunkSize ?? 100,
            subscribeDelayMs: this.cfg.subscribeDelayMs ?? 350
          },
          "ws open"
        );

        const chunkSize = this.cfg.subscribeChunkSize ?? 100;
        const delayMs = this.cfg.subscribeDelayMs ?? 350; // ~3 req/sec

        for (let i = 0; i < this.cfg.instIds.length; i += chunkSize) {
            const chunk = this.cfg.instIds.slice(i, i + chunkSize);

            const args = chunk.map((instId) => ({
                channel: "tickers",
                instId
            }));

            this.ws?.send(JSON.stringify({ op: "subscribe", args }));
            this.cfg.log?.info(
              {
                exchange: "okx",
                connId: this.connId,
                chunkIndex: Math.floor(i / chunkSize),
                chunkSize: chunk.length,
                firstSymbol: chunk[0],
                lastSymbol: chunk[chunk.length - 1]
              },
              "ws subscribe chunk"
            );

            // OKX WebSocket: connection limit 3 requests/sec (based on IP) :contentReference[oaicite:7]{index=7}
            await sleep(delayMs);
        }
    });

    this.ws.on("message", (buf) => {
      const text = buf.toString();
      this.messagesReceived += 1;
      this.lastMessageAt = Date.now();

      // Some WS servers send plain "pong"/"ping" strings; safe to ignore.
      if (text === "pong") return;
      if (text === "ping") {
        this.ws?.send("pong");
        return;
      }

      let msg: OkxTickersMsg;
      try {
        msg = JSON.parse(text) as OkxTickersMsg;
      } catch {
        return;
      }

      // subscription acks/errors
      if (msg.event === "error") return;

      if (msg.arg?.channel !== "tickers" || !msg.data?.length) return;

      for (const d of msg.data) {
        const exchangeSymbol = d.instId;
        if (!exchangeSymbol) continue;

        // We want perps: OKX perps are *-SWAP, parseOkxPerpSymbol handles that.
        const parsed = parseOkxPerpSymbol(exchangeSymbol);
        if (!parsed) continue;

        const bidPrice = toNum(d.bidPx);
        const bidQty = toNum(d.bidSz);
        const askPrice = toNum(d.askPx);
        const askQty = toNum(d.askSz);
        const ts = toNum(d.ts);

        if (![bidPrice, bidQty, askPrice, askQty, ts].every(Number.isFinite))
          continue;

        bus.emit("market:top", {
          exchange: "okx",
          symbol: parsed.canonical,
          exchangeSymbol, // raw instId like BTC-USDT-SWAP
          bidPrice,
          bidQty,
          askPrice,
          askQty,
          ts
        });
        this.topsEmitted += 1;
      }
    });

    this.ws.on("close", (code, reason) => {
      // later: reconnect w/ backoff
      this.cfg.log?.warn(
        {
          exchange: "okx",
          connId: this.connId,
          code,
          reason: reason?.toString(),
          lastMessageAt: this.lastMessageAt,
          messagesReceived: this.messagesReceived,
          topsEmitted: this.topsEmitted
        },
        "ws close"
      );
      this.ws = null;
    });

    this.ws.on("error", (err) => {
      const payload = {
        exchange: "okx",
        connId: this.connId,
        err: err instanceof Error ? { name: err.name, message: err.message } : String(err)
      };
      if (this.cfg.log?.error) {
        this.cfg.log.error(payload, "ws error");
      } else {
        this.cfg.log?.warn(payload, "ws error");
      }
    });
  }

  async stop() {
    this.ws?.close();
    this.ws = null;
  }
}
