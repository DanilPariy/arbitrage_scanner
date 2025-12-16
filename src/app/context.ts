import { TypedBus } from "../streams/bus.js";
import type { AppEvents } from "../streams/events.js";
import { OppsStore } from "../streams/oppsStore.js";

export type AppContext = {
  bus: TypedBus<AppEvents>;
  opps: OppsStore;
};

export function buildContext(): AppContext {
  const bus = new TypedBus<AppEvents>();
  const opps = new OppsStore(bus);
  return { bus, opps };
}
