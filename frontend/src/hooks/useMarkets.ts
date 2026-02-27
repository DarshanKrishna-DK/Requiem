import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import type {
  RawMarketRow,
  AggregatedMarketRow,
  MarketCardData,
  PlatformDetail,
} from "../lib/types";

function buildFromRaw(rows: RawMarketRow[]): MarketCardData[] {
  return rows
    .filter((r) => r.yes_price !== null && r.liquidity_usd !== null)
    .map((r) => ({
      id: r.id,
      title: r.title,
      expiry: r.expiry_at,
      totalLiquidity: Number(r.liquidity_usd) || 0,
      platforms: [
        {
          platform: r.platform,
          yes_price: Number(r.yes_price) || 0,
          no_price: Number(r.no_price) || 0,
          liquidity: Number(r.liquidity_usd) || 0,
          market_id: `${r.platform}-${r.external_id}`,
        },
      ],
      weightedYes: Number(r.yes_price) || null,
      weightedNo: Number(r.no_price) || null,
      isAggregated: false,
    }));
}

function buildFromAggregated(rows: AggregatedMarketRow[]): MarketCardData[] {
  return rows.map((r) => {
    let platforms: PlatformDetail[] = [];
    try {
      platforms = JSON.parse(r.platforms) as PlatformDetail[];
    } catch {
      /* empty */
    }

    return {
      id: r.id,
      title: r.canonical_title,
      expiry: r.expiry_at,
      totalLiquidity: Number(r.total_liquidity) || 0,
      platforms,
      weightedYes: r.weighted_yes_price ? Number(r.weighted_yes_price) : null,
      weightedNo: r.weighted_no_price ? Number(r.weighted_no_price) : null,
      isAggregated: true,
    };
  });
}

export function useMarkets() {
  const [markets, setMarkets] = useState<MarketCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  async function fetchData() {
    setLoading(true);
    setError(null);

    const [rawRes, aggRes] = await Promise.all([
      supabase
        .from("raw_markets")
        .select("*")
        .order("liquidity_usd", { ascending: false }),
      supabase
        .from("aggregated_markets")
        .select("*")
        .order("total_liquidity", { ascending: false }),
    ]);

    if (rawRes.error) {
      setError(rawRes.error.message);
      setLoading(false);
      return;
    }

    const rawCards = buildFromRaw(rawRes.data ?? []);
    const aggCards = buildFromAggregated(aggRes.data ?? []);

    const aggMarketIds = new Set<string>();
    for (const agg of aggCards) {
      for (const p of agg.platforms) {
        aggMarketIds.add(p.market_id);
      }
    }

    const standaloneCards = rawCards.filter((c) => {
      const mid = c.platforms[0]?.market_id;
      return !aggMarketIds.has(mid);
    });

    setMarkets([...aggCards, ...standaloneCards]);
    setLastUpdated(new Date());
    setLoading(false);
  }

  useEffect(() => {
    fetchData();
  }, []);

  return { markets, loading, error, lastUpdated, refresh: fetchData };
}
