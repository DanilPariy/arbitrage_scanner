import type { AppEvents } from "./events.js";
import { TypedBus } from "./bus.js";
import type { PerpOpportunity } from "../../../shared/types.js";

export class OppsStore {
  private bus: TypedBus<AppEvents>;
  private top: PerpOpportunity[] = [];
  private updatedAt = 0;

  constructor(bus: TypedBus<AppEvents>) {
    this.bus = bus;
  }

  getSnapshot() {
    return { top: this.top, updatedAt: this.updatedAt };
  }

  setTop(top: PerpOpportunity[]) {
    this.top = top;
    this.updatedAt = Date.now();

    this.bus.emit("opps:update", { top: this.top, updatedAt: this.updatedAt });
  }
}
