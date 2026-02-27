export type Platform = "predict" | "probable" | "xo" | "polymarket";

export interface RawMarket {
  external_id: string;
  title: string;
  platform: Platform;
  yes_price: number | null;
  no_price: number | null;
  liquidity_usd: number | null;
  expiry_at: Date | null;
  status: string;
}

export interface FetcherResult {
  platform: Platform;
  markets: RawMarket[];
  skipped: boolean;
  skipReason?: string;
  error?: string;
}

export interface Market {
  id: string;
  title: string;
  platform: Platform;
  yes_price: number;
  no_price: number;
  liquidity: number;
  expiry: Date;
}

export interface MatchedGroup {
  canonical_title: string;
  markets: Market[];
  total_liquidity: number;
  expiry: Date;
  best_yes: { platform: Platform; price: number };
  best_no: { platform: Platform; price: number };
}
