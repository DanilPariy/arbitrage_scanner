import type { TypedBus } from "../../streams/bus.js";
import type { AppEvents } from "../../streams/events.js";
import { discoverOkxUsdtSwaps } from "./okxDiscovery.js";
import { OkxPerpConnector } from "./okxPerpConnector.js";

function chunk<T>(arr: T[], n: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

export type OkxManagerConfig = {
  restBaseUrl: string;       // "https://www.okx.com"
  wsUrl: string;             // "wss://ws.okx.com:8443/ws/v5/public"
  quote: "USDT";

  minVolCcy24h: number;      // liquidity filter (USDT)
  maxInstruments: number;    // cap universe size

  maxWsConnections: number;  // e.g. 5
  perConnectionInstruments: number; // e.g. 200

  subscribeChunkSize: number; // e.g. 100
  subscribeDelayMs: number;   // e.g. 350
};

export class OkxPerpManager {
  private connectors: OkxPerpConnector[] = [];

  constructor(private cfg: OkxManagerConfig) {}

  async start(bus: TypedBus<AppEvents>) {
    const instIds = await discoverOkxUsdtSwaps({
      restBaseUrl: this.cfg.restBaseUrl,
      quote: this.cfg.quote,
      minVolCcy24h: this.cfg.minVolCcy24h,
      maxInstruments: this.cfg.maxInstruments
    });

    const groups = chunk(instIds, this.cfg.perConnectionInstruments).slice(0, this.cfg.maxWsConnections);

    this.connectors = groups.map(
      (g) =>
        new OkxPerpConnector({
          url: this.cfg.wsUrl,
          instIds: g,
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
