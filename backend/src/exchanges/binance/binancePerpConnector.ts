import WebSocket from "ws";
import type { ExchangeConnector, ConnectorState } from "../connector.js";
import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import { parseBinanceUsdMPerpSymbol } from "../../core/symbols.js";

type CombinedStreamMsg = {
  stream: string;
  data: unknown;
};

// Binance !bookTicker payload (USD-M futures). Keep it tolerant: fields are typically:
// { e, E, s, b, B, a, A } (strings for prices/qty)
type BinanceBookTicker = {
  e?: string;
  E?: number;
  s?: string;
  b?: string; // best bid price
  B?: string; // best bid qty
  a?: string; // best ask price
  A?: string; // best ask qty
};

function toNum(x: unknown): number {
  if (typeof x === "number") return x;
  if (typeof x === "string") return Number(x);
  return NaN;
}

export class BinancePerpConnector implements ExchangeConnector<AppEvents> {
  readonly id = "binance";
  state: ConnectorState = "idle";

  private ws: WebSocket | null = null;
  private bus: TypedBus<AppEvents> | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private shouldRun = false;

  // USD-M futures base URL and combined streams format :contentReference[oaicite:4]{index=4}
  private readonly url = "wss://fstream.binance.com/stream?streams=!bookTicker"; // !bookTicker :contentReference[oaicite:5]{index=5}

  async start(bus: TypedBus<AppEvents>): Promise<void> {
    if (this.state === "running" || this.state === "connecting") return;
    this.bus = bus;
    this.shouldRun = true;
    await this.connect();
  }

  async stop(): Promise<void> {
    this.shouldRun = false;
    this.state = "stopped";
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;

    if (this.ws) {
      const w = this.ws;
      this.ws = null;
      w.removeAllListeners();
      w.close();
    }
  }

  private async connect(): Promise<void> {
    if (!this.shouldRun) return;

    this.state = "connecting";
    const ws = new WebSocket(this.url);
    this.ws = ws;

    ws.on("open", () => {
      this.state = "running";
    });

    ws.on("message", (buf) => {
      try {
        const text = buf.toString("utf8");
        const msg = JSON.parse(text) as CombinedStreamMsg;

        // Combined streams are wrapped as {"stream": "...", "data": ...} :contentReference[oaicite:6]{index=6}
        if (msg?.stream === "!bookTicker") {
          this.handleBookTicker(msg.data as BinanceBookTicker);
        }
      } catch {
        // ignore bad frames; in prod you'd count metrics
      }
    });

    // Keepalive: Binance sends ping frames periodically :contentReference[oaicite:7]{index=7}
    ws.on("ping", (data) => {
      // ws library will often auto-handle pong, but doing it explicitly is safe
      try {
        ws.pong(data);
      } catch {}
    });

    ws.on("close", () => {
      this.ws = null;
      if (!this.shouldRun) return;
      this.state = "idle";
      this.scheduleReconnect();
    });

    ws.on("error", () => {
      // error often followed by close
      this.state = "error";
    });
  }

  private scheduleReconnect() {
    if (this.reconnectTimer || !this.shouldRun) return;

    // simple backoff (later you can make it exponential + jitter)
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connect();
    }, 1000);
  }

  private handleBookTicker(data: BinanceBookTicker) {
  if (!this.bus) return;
  if (!data?.s) return;

  const parsed = parseBinanceUsdMPerpSymbol(data.s);
  if (!parsed) return; // ignore unknown symbols (or log later)

  const bidPrice = toNum(data.b);
  const bidQty = toNum(data.B);
  const askPrice = toNum(data.a);
  const askQty = toNum(data.A);
  const ts = typeof data.E === "number" ? data.E : Date.now();

  if (![bidPrice, bidQty, askPrice, askQty].every(Number.isFinite)) return;

  this.bus.emit("market:top", {
    exchange: "binance",
    symbol: parsed.canonical,     // ✅ normalized
    exchangeSymbol: data.s,       // ✅ raw
    bidPrice,
    bidQty,
    askPrice,
    askQty,
    ts
  });
}
}
