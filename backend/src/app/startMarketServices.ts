import type { FastifyInstance } from "fastify";
import { env } from "../config/env.js";
import { ArbEngine } from "../core/arbEngine.js";
import { FundingOppEngine } from "../core/fundingOppEngine.js";
import { FundingTracker } from "../core/fundingTracker.js";
import { BinanceFundingPoller } from "../exchanges/binance/binanceFundingPoller.js";
import { BinancePerpConnector } from "../exchanges/binance/binancePerpConnector.js";
import { BitgetFundingPoller } from "../exchanges/bitget/bitgetFundingPoller.js";
import { BitgetPerpManager } from "../exchanges/bitget/bitgetPerpManager.js";
import { BybitFundingPoller } from "../exchanges/bybit/bybitFundingPoller.js";
import { BybitPerpManager } from "../exchanges/bybit/bybitPerpManager.js";
import { OkxFundingPoller } from "../exchanges/okx/okxFundingPoller.js";
import { OkxPerpManager } from "../exchanges/okx/okxPerpManager.js";

const MARKET_DISCOVERY_LIMITS = {
  minTurnover24h: 1_000_000,
  maxInstruments: 800,
  maxWsConnections: 4,
  perConnectionInstruments: 200,
  subscribeChunkSize: 100,
  subscribeDelayMs: 350
} as const;

const FUNDING_POLLING = {
  normalPollMs: 60_000,
  nearFundingMs: 10 * 60_000,
  nearPollMs: 10_000
} as const;

export async function startMarketServices(app: FastifyInstance): Promise<void> {
  const binance = new BinancePerpConnector();
  await binance.start(app.ctx.bus);

  const okx = new OkxPerpManager({
    restBaseUrl: "https://www.okx.com",
    wsUrl: env.OKX_WS_URL,
    quote: "USDT",
    log: app.log,
    minVolCcy24h: MARKET_DISCOVERY_LIMITS.minTurnover24h,
    maxInstruments: MARKET_DISCOVERY_LIMITS.maxInstruments,
    maxWsConnections: MARKET_DISCOVERY_LIMITS.maxWsConnections,
    perConnectionInstruments: MARKET_DISCOVERY_LIMITS.perConnectionInstruments,
    subscribeChunkSize: MARKET_DISCOVERY_LIMITS.subscribeChunkSize,
    subscribeDelayMs: MARKET_DISCOVERY_LIMITS.subscribeDelayMs
  });
  await okx.start(app.ctx.bus);

  const bybit = new BybitPerpManager({
    restBaseUrl: env.BYBIT_REST_BASE_URL,
    wsUrl: env.BYBIT_WS_URL,
    quote: "USDT",
    minTurnover24h: MARKET_DISCOVERY_LIMITS.minTurnover24h,
    maxInstruments: MARKET_DISCOVERY_LIMITS.maxInstruments,
    maxWsConnections: MARKET_DISCOVERY_LIMITS.maxWsConnections,
    perConnectionInstruments: MARKET_DISCOVERY_LIMITS.perConnectionInstruments,
    subscribeChunkSize: MARKET_DISCOVERY_LIMITS.subscribeChunkSize,
    subscribeDelayMs: MARKET_DISCOVERY_LIMITS.subscribeDelayMs
  });
  await bybit.start(app.ctx.bus);

  const bitget = new BitgetPerpManager({
    restBaseUrl: env.BITGET_REST_BASE_URL,
    wsUrl: env.BITGET_WS_URL,
    quote: "USDT",
    productType: "USDT-FUTURES",
    log: app.log,
    minTurnover24h: MARKET_DISCOVERY_LIMITS.minTurnover24h,
    maxInstruments: MARKET_DISCOVERY_LIMITS.maxInstruments,
    maxWsConnections: MARKET_DISCOVERY_LIMITS.maxWsConnections,
    perConnectionInstruments: MARKET_DISCOVERY_LIMITS.perConnectionInstruments,
    subscribeChunkSize: MARKET_DISCOVERY_LIMITS.subscribeChunkSize,
    subscribeDelayMs: MARKET_DISCOVERY_LIMITS.subscribeDelayMs
  });
  await bitget.start(app.ctx.bus);

  const fundingTracker = new FundingTracker(app.ctx.bus, app.log);
  fundingTracker.start();

  new BinanceFundingPoller(app.ctx.bus, app.ctx.symbols, app.log, {
    restBaseUrl: "https://fapi.binance.com",
    ...FUNDING_POLLING
  }).start();

  new OkxFundingPoller(app.ctx.bus, app.ctx.symbols, app.log, {
    restBaseUrl: "https://www.okx.com",
    ...FUNDING_POLLING
  }).start();

  new BybitFundingPoller(app.ctx.bus, app.ctx.symbols, app.log, {
    restBaseUrl: env.BYBIT_REST_BASE_URL,
    ...FUNDING_POLLING
  }).start();

  new BitgetFundingPoller(app.ctx.bus, app.ctx.symbols, app.log, {
    restBaseUrl: env.BITGET_REST_BASE_URL,
    productType: "USDT-FUTURES",
    ...FUNDING_POLLING
  }).start();

  const fundingOpps = new FundingOppEngine(
    app.ctx.bus,
    {
      minFundingEdgeBps: 2,
      minTimeAliveMs: 1500,
      minTopQty: 1,
      maxOpps: 25,
      publishIntervalMs: 300,
      staleOppMs: 5000
    },
    fundingTracker.getStore()
  );
  fundingOpps.start();

  const arbEngine = new ArbEngine(
    app.ctx.bus,
    {
      minNetEdgeBps: 5,
      minTimeAliveMs: 1500,
      minTopQty: 1,
      maxOpps: 25,
      publishIntervalMs: 300,
      staleOppMs: 5000
    },
    fundingTracker.getStore()
  );
  arbEngine.start();
}
