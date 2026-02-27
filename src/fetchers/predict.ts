import axios from "axios";
import { env } from "../config/env.js";
import type { RawMarket, FetcherResult } from "../types/market.js";

interface PredictOutcome {
  name: string;
  indexSet: number;
  status: string | null;
}

interface PredictStats {
  totalLiquidityUsd: number;
  volumeTotalUsd: number;
  volume24hUsd: number;
}

interface PredictMarket {
  id: number;
  title: string;
  question: string;
  tradingStatus: string;
  status: string;
  categorySlug: string;
  createdAt: string;
  outcomes: PredictOutcome[];
  stats: PredictStats | null;
}

interface PredictMarketsResponse {
  success: boolean;
  cursor: string;
  data: PredictMarket[];
}

interface PredictCategory {
  endsAt: string | null;
}

interface PredictCategoryResponse {
  success: boolean;
  data: PredictCategory;
}

interface OrderbookResponse {
  success: boolean;
  data: {
    bids: [number, number][];
    asks: [number, number][];
  };
}

const CONCURRENCY = 5;

async function batchProcess<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    results.push(...(await Promise.all(batch.map(fn))));
  }
  return results;
}

async function fetchOrderbookMidpoint(
  marketId: number
): Promise<{ yes: number | null; no: number | null }> {
  try {
    const { data } = await axios.get<OrderbookResponse>(
      `${env.PREDICT_BASE_URL}/v1/markets/${marketId}/orderbook`,
      { timeout: 8000 }
    );
    const bestBid = data.data.bids[0]?.[0] ?? null;
    const bestAsk = data.data.asks[0]?.[0] ?? null;

    if (bestBid !== null && bestAsk !== null) {
      const mid = +((bestBid + bestAsk) / 2).toFixed(4);
      return { yes: mid, no: +(1 - mid).toFixed(4) };
    }
    if (bestBid !== null) return { yes: bestBid, no: +(1 - bestBid).toFixed(4) };
    if (bestAsk !== null) return { yes: bestAsk, no: +(1 - bestAsk).toFixed(4) };
    return { yes: null, no: null };
  } catch {
    return { yes: null, no: null };
  }
}

const categoryExpiryCache = new Map<string, Date | null>();

async function fetchCategoryExpiry(slug: string): Promise<Date | null> {
  if (categoryExpiryCache.has(slug)) return categoryExpiryCache.get(slug)!;
  try {
    const { data } = await axios.get<PredictCategoryResponse>(
      `${env.PREDICT_BASE_URL}/v1/categories/${slug}`,
      { timeout: 8000 }
    );
    const expiry = data.data.endsAt ? new Date(data.data.endsAt) : null;
    categoryExpiryCache.set(slug, expiry);
    return expiry;
  } catch {
    categoryExpiryCache.set(slug, null);
    return null;
  }
}

export async function fetchPredictMarkets(): Promise<FetcherResult> {
  const tag = "[predict]";
  console.log(`${tag} Fetching markets from ${env.PREDICT_BASE_URL}...`);

  try {
    const { data } = await axios.get<PredictMarketsResponse>(
      `${env.PREDICT_BASE_URL}/v1/markets`,
      { params: { limit: 50, includeStats: true } }
    );

    if (!data.success) {
      return {
        platform: "predict",
        markets: [],
        skipped: false,
        error: "API returned success=false",
      };
    }

    const active = data.data.filter(
      (m) => m.tradingStatus === "OPEN" && m.status === "REGISTERED"
    );

    console.log(
      `${tag} Found ${active.length} active markets (of ${data.data.length} total), fetching prices...`
    );

    const categorySlugs = [...new Set(active.map((m) => m.categorySlug))];
    await Promise.all(categorySlugs.map(fetchCategoryExpiry));

    const markets = await batchProcess(
      active,
      async (m): Promise<RawMarket> => {
        const price = await fetchOrderbookMidpoint(m.id);
        const expiry = await fetchCategoryExpiry(m.categorySlug);

        return {
          external_id: String(m.id),
          title: m.question,
          platform: "predict",
          yes_price: price.yes,
          no_price: price.no,
          liquidity_usd: m.stats?.totalLiquidityUsd ?? null,
          expiry_at: expiry,
          status: m.tradingStatus,
        };
      },
      CONCURRENCY
    );

    console.log(`${tag} Done. ${markets.length} markets with price data.`);
    return { platform: "predict", markets, skipped: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} Error: ${message}`);
    return { platform: "predict", markets: [], skipped: false, error: message };
  }
}
