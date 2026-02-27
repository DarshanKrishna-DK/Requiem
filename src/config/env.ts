import dotenv from "dotenv";
dotenv.config();

export const env = {
  PREDICT_BASE_URL:
    process.env.PREDICT_BASE_URL || "https://api-testnet.predict.fun",

  PROBABLE_MARKET_API_URL:
    process.env.PROBABLE_MARKET_API_URL ||
    "https://market-api.probable.markets/public/api/v1",
  PROBABLE_CLOB_API_URL:
    process.env.PROBABLE_CLOB_API_URL ||
    "https://api.probable.markets/public/api/v1",

  XO_API_URL:
    process.env.XO_API_URL || "https://api-mainnet.xo.market/api",

  POLYMARKET_API_URL:
    process.env.POLYMARKET_API_URL || "https://gamma-api.polymarket.com",

  SUPABASE_URL: process.env.SUPABASE_URL || "",
  SUPABASE_ANON_KEY: process.env.SUPABASE_ANON_KEY || "",
} as const;
