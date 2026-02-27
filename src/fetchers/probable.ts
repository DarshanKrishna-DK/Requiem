import axios from "axios";
import { env } from "../config/env.js";
import type { RawMarket, FetcherResult } from "../types/market.js";

interface ProbableToken {
  token_id: string;
  outcome: string;
}

interface ProbableMarket {
  id: string;
  question: string;
  market_slug: string;
  outcomes: string;
  volume24hr: string;
  liquidity: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  startDate: string;
  endDate: string;
  tokens: ProbableToken[];
  resolved: boolean;
}

interface ProbableEvent {
  id: string;
  slug: string;
  title: string;
  active: boolean;
  closed: boolean;
  archived: boolean;
  ended: boolean;
  liquidity: string;
  volume: string;
  markets: ProbableMarket[];
}

interface MidpointResponse {
  mid: string;
}

async function getMidpoint(tokenId: string): Promise<number | null> {
  try {
    const { data } = await axios.get<MidpointResponse>(
      `${env.PROBABLE_CLOB_API_URL}/midpoint`,
      { params: { token_id: tokenId }, timeout: 5000 }
    );
    return data.mid ? parseFloat(data.mid) : null;
  } catch {
    return null;
  }
}

async function batchProcess<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  concurrency: number
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

async function normalizeMarket(
  market: ProbableMarket
): Promise<RawMarket> {
  const yesToken = market.tokens?.find((t) => t.outcome === "Yes");
  const noToken = market.tokens?.find((t) => t.outcome === "No");

  const [yesPrice, noPrice] = await Promise.all([
    yesToken ? getMidpoint(yesToken.token_id) : Promise.resolve(null),
    noToken ? getMidpoint(noToken.token_id) : Promise.resolve(null),
  ]);

  return {
    external_id: market.id,
    title: market.question,
    platform: "probable",
    yes_price: yesPrice,
    no_price: noPrice,
    liquidity_usd: market.liquidity ? parseFloat(market.liquidity) : null,
    expiry_at: market.endDate ? new Date(market.endDate) : null,
    status: market.active ? "ACTIVE" : market.closed ? "CLOSED" : "UNKNOWN",
  };
}

export async function fetchProbableMarkets(): Promise<FetcherResult> {
  const tag = "[probable]";
  console.log(`${tag} Fetching events from Probable Markets API...`);

  try {
    const { data: events } = await axios.get<ProbableEvent[]>(
      `${env.PROBABLE_MARKET_API_URL}/events`,
      { params: { limit: 20, active: true }, timeout: 15000 }
    );

    const now = Date.now();
    const activeMarkets = events.flatMap((event) =>
      (event.markets || []).filter((m) => {
        if (!m.active || m.closed || m.archived || m.resolved) return false;
        if (m.endDate && new Date(m.endDate).getTime() <= now) return false;
        return true;
      })
    );

    console.log(
      `${tag} Found ${activeMarkets.length} active markets across ${events.length} events, fetching prices...`
    );

    const markets = await batchProcess(activeMarkets, normalizeMarket, 5);

    console.log(`${tag} Done. ${markets.length} markets with price data.`);
    return { platform: "probable", markets, skipped: false };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`${tag} Error: ${message}`);
    return {
      platform: "probable",
      markets: [],
      skipped: false,
      error: message,
    };
  }
}
