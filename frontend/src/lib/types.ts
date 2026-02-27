export type Platform = "predict" | "probable" | "xo" | "polymarket";

export interface RawMarketRow {
  id: string;
  platform: Platform;
  external_id: string;
  title: string;
  yes_price: number | null;
  no_price: number | null;
  liquidity_usd: number | null;
  expiry_at: string | null;
  status: string | null;
  updated_at: string;
}

export interface AggregatedMarketRow {
  id: string;
  canonical_title: string;
  total_liquidity: number;
  weighted_yes_price: number | null;
  weighted_no_price: number | null;
  expiry_at: string | null;
  platform_count: number;
  platforms: string;
  updated_at: string;
}

export interface PlatformDetail {
  platform: Platform;
  yes_price: number;
  no_price: number;
  liquidity: number;
  market_id: string;
}

export interface MarketCardData {
  id: string;
  title: string;
  expiry: string | null;
  totalLiquidity: number;
  platforms: PlatformDetail[];
  weightedYes: number | null;
  weightedNo: number | null;
  isAggregated: boolean;
}

export const PLATFORM_CONFIG: Record<
  Platform,
  { label: string; color: string; bg: string }
> = {
  predict: { label: "Predict.fun", color: "text-predict", bg: "bg-predict/15" },
  probable: { label: "Probable", color: "text-probable", bg: "bg-probable/15" },
  xo: { label: "XO Market", color: "text-xo", bg: "bg-xo/15" },
  polymarket: { label: "Polymarket", color: "text-polymarket", bg: "bg-polymarket/15" },
};
