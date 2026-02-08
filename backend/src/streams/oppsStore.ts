import type { AppEvents } from "./events.js";
import { TypedBus } from "./bus.js";
import type { PerpOpportunity } from "../../../shared/types.js";

export class OppsStore {
  private top: PerpOpportunity[] = [];
  private updatedAt = 0;

  constructor(bus: TypedBus<AppEvents>) {
    bus.on("opps:update", (payload) => {
      this.top = payload.top;
      this.updatedAt = payload.updatedAt;
    });
  }

  getSnapshot() {
    return { top: this.top, updatedAt: this.updatedAt };
  }
}
