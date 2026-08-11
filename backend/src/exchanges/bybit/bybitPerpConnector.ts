import WebSocket from "ws";
import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import { parseBybitPerpSymbol } from "../../core/symbols.js";
import { sleep } from "../../core/sleep.js";

type BybitTickerMsg = {
  topic?: string;
  type?: string;
  ts?: number;
  data?:
    | {
        symbol?: string;
        bid1Price?: string;
        bid1Size?: string;
        ask1Price?: string;
        ask1Size?: string;
      }
    | Array<{
        symbol?: string;
        bid1Price?: string;
        bid1Size?: string;
        ask1Price?: string;
        ask1Size?: string;
      }>;
  op?: string;
  args?: string[];
  success?: boolean;
  ret_msg?: string;
  retMsg?: string;
};

function toNum(x: unknown): number {
  const n = typeof x === "string" ? Number(x) : typeof x === "number" ? x : NaN;
  return Number.isFinite(n) ? n : NaN;
}

export class BybitPerpConnector {
  private ws: WebSocket | null = null;

  constructor(
    private readonly cfg: {
      url: string;
      symbols: string[]; // e.g. ["BTCUSDT", "ETHUSDT"]
      subscribeChunkSize?: number;
      subscribeDelayMs?: number;
    }
  ) {}

  async start(bus: TypedBus<AppEvents>) {
    this.ws = new WebSocket(this.cfg.url);

    this.ws.on("open", async () => {
      const chunkSize = this.cfg.subscribeChunkSize ?? 100;
      const delayMs = this.cfg.subscribeDelayMs ?? 350;

      for (let i = 0; i < this.cfg.symbols.length; i += chunkSize) {
        const chunk = this.cfg.symbols.slice(i, i + chunkSize);
        const args = chunk.map((s) => `tickers.${s}`);
        this.ws?.send(JSON.stringify({ op: "subscribe", args }));
        await sleep(delayMs);
      }
    });

    this.ws.on("message", (buf) => {
      const text = buf.toString();
      let msg: BybitTickerMsg;

      try {
        msg = JSON.parse(text) as BybitTickerMsg;
      } catch {
        return;
      }

      if (msg.op === "ping") {
        this.ws?.send(JSON.stringify({ op: "pong" }));
        return;
      }

      if (!msg.topic?.startsWith("tickers."))
        return;
      if (msg.type !== "snapshot")
        return;
      if (!msg.data)
        return;

      const ts = toNum(msg.ts);
      if (!Number.isFinite(ts)) return;

      const rows = Array.isArray(msg.data) ? msg.data : [msg.data];

      for (const row of rows) {
        const exchangeSymbol = row.symbol;
        if (!exchangeSymbol) continue;

        const parsed = parseBybitPerpSymbol(exchangeSymbol);
        if (!parsed) continue;

        const bidPrice = toNum(row.bid1Price);
        const bidQty = toNum(row.bid1Size);
        const askPrice = toNum(row.ask1Price);
        const askQty = toNum(row.ask1Size);

        if (![bidPrice, bidQty, askPrice, askQty].every(Number.isFinite))
          continue;

        bus.emit("market:top", {
          exchange: "bybit",
          symbol: parsed.canonical,
          exchangeSymbol,
          bidPrice,
          bidQty,
          askPrice,
          askQty,
          ts,
        });
      }
    });

    this.ws.on("close", () => {
      this.ws = null;
    });

    this.ws.on("error", () => {
      // later: reconnect w/ backoff
    });
  }

  async stop() {
    this.ws?.close();
    this.ws = null;
  }
}
