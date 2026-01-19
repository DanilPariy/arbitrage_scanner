import { TypedBus } from "../streams/bus.js";
import type { AppEvents } from "../streams/events.js";
import { OppsStore } from "../streams/oppsStore.js";
import { SymbolRegistry } from "../core/symbolRegistry.js";

export type AppContext = {
  bus: TypedBus<AppEvents>;
  opps: OppsStore;
  symbols: SymbolRegistry;
};

export function buildContext(): AppContext {
  const bus = new TypedBus<AppEvents>();
  const opps = new OppsStore(bus);
  const symbols = new SymbolRegistry();

  return { bus, opps, symbols };
}
