import type { TypedBus } from "../streams/bus.js";

export type ConnectorState = "idle" | "connecting" | "running" | "stopped" | "error";

export interface ExchangeConnector<AppEvents extends Record<string, unknown>> {
  readonly id: string; // "binance"
  readonly state: ConnectorState;

  start(bus: TypedBus<AppEvents>): Promise<void>;
  stop(): Promise<void>;
}
