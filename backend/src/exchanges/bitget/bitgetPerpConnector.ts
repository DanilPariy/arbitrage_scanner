import WebSocket from "ws";
import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import { parseBitgetPerpSymbol } from "../../core/symbols.js";
import { sleep } from "../../core/sleep.js";
import type { LoggerLike } from "../../core/symbolRegistry.js";

type BitgetWsMsg = {
  event?: string;
  op?: string;
  arg?: { channel?: string; instType?: string; instId?: string };
  data?: Array<Record<string, unknown>>;
  code?: string | number;
  msg?: string;
};

function toNum(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  return NaN;
}

function pickNum(row: Record<string, unknown>, keys: string[]): number {
  for (const k of keys) {
    const v = toNum(row[k]);
    if (Number.isFinite(v)) return v;
  }
  return NaN;
}

export class BitgetPerpConnector {
  private ws: WebSocket | null = null;
  private readonly connId: number;
  private messagesReceived = 0;
  private topsEmitted = 0;
  private lastMessageAt: number | null = null;
  private static nextId = 1;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldRun = false;

  constructor(
    private readonly cfg: {
      url: string;
      productType: string; // e.g. USDT-FUTURES
      symbols: string[];   // e.g. ["BTCUSDT", "ETHUSDT"]
      subscribeChunkSize?: number;
      subscribeDelayMs?: number;
      log?: LoggerLike;
    }
  ) {
    this.connId = BitgetPerpConnector.nextId++;
  }

  async start(bus: TypedBus<AppEvents>) {
    this.shouldRun = true;
    this.connect(bus);
  }

  private connect(bus: TypedBus<AppEvents>) {
    if (!this.shouldRun) return;
    this.ws = new WebSocket(this.cfg.url);

    this.ws.on("open", async () => {
      this.cfg.log?.info(
        {
          exchange: "bitget",
          connId: this.connId,
          url: this.cfg.url,
          symbolsCount: this.cfg.symbols.length,
          subscribeChunkSize: this.cfg.subscribeChunkSize ?? 100,
          subscribeDelayMs: this.cfg.subscribeDelayMs ?? 350
        },
        "ws open"
      );

      const chunkSize = this.cfg.subscribeChunkSize ?? 100;
      const delayMs = this.cfg.subscribeDelayMs ?? 350;

      for (let i = 0; i < this.cfg.symbols.length; i += chunkSize) {
        const chunk = this.cfg.symbols.slice(i, i + chunkSize);
        const args = chunk.map((instId) => ({
          instType: this.cfg.productType,
          channel: "ticker",
          instId
        }));

        this.ws?.send(JSON.stringify({ op: "subscribe", args }));
        this.cfg.log?.info(
          {
            exchange: "bitget",
            connId: this.connId,
            chunkIndex: Math.floor(i / chunkSize),
            chunkSize: chunk.length,
            firstSymbol: chunk[0],
            lastSymbol: chunk[chunk.length - 1]
          },
          "ws subscribe chunk"
        );
        await sleep(delayMs);
      }
    });

    this.ws.on("message", (buf) => {
      const text = buf.toString();
      this.messagesReceived += 1;
      this.lastMessageAt = Date.now();

      if (text === "ping") {
        this.ws?.send("pong");
        return;
      }
      if (text === "pong") return;

      let msg: BitgetWsMsg;
      try {
        msg = JSON.parse(text) as BitgetWsMsg;
      } catch {
        return;
      }

      if (msg.event === "error") return;
      if (!msg.data?.length) return;
      if (msg.arg?.channel && msg.arg.channel !== "ticker") return;

      for (const row of msg.data) {
        const exchangeSymbol = String(row.instId ?? row.symbol ?? "");
        if (!exchangeSymbol) continue;

        const parsed = parseBitgetPerpSymbol(exchangeSymbol);
        if (!parsed) continue;

        const bidPrice = pickNum(row, ["bidPr", "bidPx", "bestBid", "bidPrice", "bid"]);
        const askPrice = pickNum(row, ["askPr", "askPx", "bestAsk", "askPrice", "ask"]);
        const bidQty = pickNum(row, ["bidSz", "bidSize", "bidQty"]);
        const askQty = pickNum(row, ["askSz", "askSize", "askQty"]);
        const ts = pickNum(row, ["ts", "timestamp"]);

        if (![bidPrice, bidQty, askPrice, askQty, ts].every(Number.isFinite))
          continue;

        bus.emit("market:top", {
          exchange: "bitget",
          symbol: parsed.canonical,
          exchangeSymbol,
          bidPrice,
          bidQty,
          askPrice,
          askQty,
          ts
        });
        this.topsEmitted += 1;
      }
    });

    this.ws.on("ping", (data) => {
      try {
        this.ws?.pong(data);
      } catch {}
    });

    this.ws.on("close", (code, reason) => {
      this.cfg.log?.warn(
        {
          exchange: "bitget",
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
      if (!this.shouldRun) return;
      this.scheduleReconnect(bus);
    });

    this.ws.on("error", (err) => {
      const payload = {
        exchange: "bitget",
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

  private scheduleReconnect(bus: TypedBus<AppEvents>) {
    if (this.reconnectTimer || !this.shouldRun) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.connect(bus);
    }, 1000);
  }

  async stop() {
    this.shouldRun = false;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    this.ws?.close();
    this.ws = null;
  }
}
