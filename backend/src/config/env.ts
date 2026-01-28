import "dotenv/config";
import { z } from "zod";

const EnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().min(1).max(65535).default(3001),
  HOST: z.string().default("0.0.0.0"),
  OKX_WS_URL: z.string().default("wss://ws.okx.com:8443/ws/v5/public"),
  OKX_INST_IDS: z.string().default("BTC-USDT-SWAP,ETH-USDT-SWAP"),
  BYBIT_REST_BASE_URL: z.string().default("https://api.bybit.com"),
  BYBIT_WS_URL: z.string().default("wss://stream.bybit.com/v5/public/linear"),
  BITGET_REST_BASE_URL: z.string().default("https://api.bitget.com"),
  BITGET_WS_URL: z.string().default("wss://ws.bitget.com/v2/ws/public")
});

export type Env = z.infer<typeof EnvSchema>;

export const env: Env = EnvSchema.parse(process.env);
