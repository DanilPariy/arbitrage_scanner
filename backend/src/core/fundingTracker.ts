import type { TypedBus } from "../streams/bus.js";
import type { AppEvents } from "../streams/events.js";
import { FundingStore } from "./fundingStore.js";
import type { LoggerLike } from "./symbolRegistry.js";

export class FundingTracker {
  private store = new FundingStore();

  constructor(private bus: TypedBus<AppEvents>, private log: LoggerLike) {}

  getStore() {
    return this.store;
  }

  start() {
    this.bus.on("funding:update", (payload) => {
      if (!Number.isFinite(payload.rate) || !Number.isFinite(payload.nextFundingTime)) {
        this.log.warn({ payload }, "ignored invalid funding update");
        return;
      }

      this.store.set(payload.exchange, payload.symbol, {
        rate: payload.rate,
        nextFundingTime: payload.nextFundingTime,
        updatedAt: payload.ts
      });
    });
  }
}
