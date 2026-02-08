import type { AppEvents } from "./events.js";
import type { FundingOpportunity } from "../../../shared/types.js";
import { TypedBus } from "./bus.js";

export class FundingOppsStore {
  private top: FundingOpportunity[] = [];
  private updatedAt = 0;

  constructor(bus: TypedBus<AppEvents>) {
    bus.on("funding:opps", (payload) => {
      this.top = payload.top;
      this.updatedAt = payload.updatedAt;
    });
  }

  getSnapshot() {
    return { top: this.top, updatedAt: this.updatedAt };
  }
}
