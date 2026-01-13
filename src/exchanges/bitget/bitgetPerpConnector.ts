import WebSocket from "ws";
import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import { parseBitgetPerpSymbol } from "../../core/symbols.js";
import { sleep } from "../../core/sleep.js";

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

  constructor(
    private readonly cfg: {
      url: string;
      productType: string; // e.g. USDT-FUTURES
      symbols: string[];   // e.g. ["BTCUSDT", "ETHUSDT"]
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
        const args = chunk.map((instId) => ({
          instType: this.cfg.productType,
          channel: "ticker",
          instId
        }));

        this.ws?.send(JSON.stringify({ op: "subscribe", args }));
        await sleep(delayMs);
      }
    });

    this.ws.on("message", (buf) => {
      const text = buf.toString();
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
        const ts = pickNum(row, ["ts", "timestamp"]) || Date.now();

        if (![bidPrice, bidQty, askPrice, askQty].every(Number.isFinite)) continue;

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
