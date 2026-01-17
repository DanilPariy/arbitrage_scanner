import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import type { LoggerLike } from "../../core/symbolRegistry.js";
import { discoverBitgetUsdtPerps } from "./bitgetDiscovery.js";
import { BitgetPerpConnector } from "./bitgetPerpConnector.js";

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export type BitgetManagerConfig = {
  restBaseUrl: string;       // "https://api.bitget.com"
  wsUrl: string;             // "wss://ws.bitget.com/v2/ws/public"
  quote: "USDT";
  productType: string;       // e.g. "USDT-FUTURES" or "UMCBL"
  log?: LoggerLike;

  minTurnover24h: number;    // liquidity filter (USDT)
  maxInstruments: number;    // cap universe size

  maxWsConnections: number;  // e.g. 4
  perConnectionInstruments: number; // e.g. 200

  subscribeChunkSize: number; // e.g. 100
  subscribeDelayMs: number;   // e.g. 350
};

export class BitgetPerpManager {
  private connectors: BitgetPerpConnector[] = [];

  constructor(private cfg: BitgetManagerConfig) {}

  async start(bus: TypedBus<AppEvents>) {
    const symbols = await discoverBitgetUsdtPerps({
      restBaseUrl: this.cfg.restBaseUrl,
      productType: this.cfg.productType,
      quote: this.cfg.quote,
      minTurnover24h: this.cfg.minTurnover24h,
      maxInstruments: this.cfg.maxInstruments
    });

    const groups = chunk(symbols, this.cfg.perConnectionInstruments).slice(0, this.cfg.maxWsConnections);

    this.connectors = groups.map(
      (g) =>
        new BitgetPerpConnector({
          url: this.cfg.wsUrl,
          productType: this.cfg.productType,
          symbols: g,
          subscribeChunkSize: this.cfg.subscribeChunkSize,
          subscribeDelayMs: this.cfg.subscribeDelayMs,
          ...(this.cfg.log ? { log: this.cfg.log } : {})
        })
    );

    for (const c of this.connectors) {
      await c.start(bus);
    }
  }

  async stop() {
    await Promise.all(this.connectors.map((c) => c.stop()));
    this.connectors = [];
  }
}
