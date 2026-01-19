import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import { discoverBybitUsdtPerps } from "./bybitDiscovery.js";
import { BybitPerpConnector } from "./bybitPerpConnector.js";

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export type BybitManagerConfig = {
  restBaseUrl: string;       // "https://api.bybit.com"
  wsUrl: string;             // "wss://stream.bybit.com/v5/public/linear"
  quote: "USDT";

  minTurnover24h: number;    // liquidity filter (USDT)
  maxInstruments: number;    // cap universe size

  maxWsConnections: number;  // e.g. 4
  perConnectionInstruments: number; // e.g. 200

  subscribeChunkSize: number; // e.g. 100
  subscribeDelayMs: number;   // e.g. 350
};

export class BybitPerpManager {
  private connectors: BybitPerpConnector[] = [];

  constructor(private cfg: BybitManagerConfig) {}

  async start(bus: TypedBus<AppEvents>) {
    const symbols = await discoverBybitUsdtPerps({
      restBaseUrl: this.cfg.restBaseUrl,
      quote: this.cfg.quote,
      minTurnover24h: this.cfg.minTurnover24h,
      maxInstruments: this.cfg.maxInstruments
    });

    const groups = chunk(symbols, this.cfg.perConnectionInstruments).slice(0, this.cfg.maxWsConnections);

    this.connectors = groups.map(
      (g) =>
        new BybitPerpConnector({
          url: this.cfg.wsUrl,
          symbols: g,
          subscribeChunkSize: this.cfg.subscribeChunkSize,
          subscribeDelayMs: this.cfg.subscribeDelayMs
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
