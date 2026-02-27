import { fetchPredictMarkets } from "./fetchers/predict.js";
import { fetchProbableMarkets } from "./fetchers/probable.js";
import { fetchXOMarkets } from "./fetchers/xo.js";
import { fetchPolymarketMarkets } from "./fetchers/polymarket.js";
import { adaptAll } from "./adapters/market-adapter.js";
import { matchMarkets } from "./matching/grouping-engine.js";
import { syncAll } from "./db/sync.js";
import { supabase } from "./db/supabase.js";
import type { FetcherResult, Platform } from "./types/market.js";

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

async function main() {
  console.log("\n=== Requiem Phase 4: Supabase Live Sync ===\n");

  // Step 1: Fetch from all platforms
  const results = await Promise.allSettled([
    fetchPredictMarkets(),
    fetchProbableMarkets(),
    fetchXOMarkets(),
    fetchPolymarketMarkets(),
  ]);

  const platforms: Platform[] = ["predict", "probable", "xo", "polymarket"];
  const fetched: FetcherResult[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      platform: platforms[i],
      markets: [],
      skipped: false,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  // Step 2: Adapt
  const rawMarkets = fetched.flatMap((f) => f.markets);
  const markets = adaptAll(rawMarkets);
  console.log(`Adapted ${markets.length} markets from ${rawMarkets.length} raw`);

  // Step 3: Match
  const { matched, unmatched } = matchMarkets(markets);
  console.log(
    `Matched: ${matched.length} groups | Unmatched: ${unmatched.length}\n`
  );

  // Step 4: Sync to Supabase
  await syncAll(markets, matched);

  // Step 5: Verify by reading back from Supabase
  console.log("\n--- Verifying Supabase Data ---\n");

  const { data: rawRows, error: rawErr } = await supabase
    .from("raw_markets")
    .select("platform, title, yes_price, no_price, liquidity_usd, expiry_at")
    .order("liquidity_usd", { ascending: false })
    .limit(15);

  if (rawErr) {
    console.error("  Error reading raw_markets:", rawErr.message);
  } else {
    console.log(`  raw_markets: ${rawRows.length} rows (showing top 15 by liquidity)\n`);
    for (const r of rawRows) {
      const title = r.title.length > 50 ? r.title.slice(0, 47) + "..." : r.title;
      const price =
        r.yes_price !== null
          ? `Y: ${Number(r.yes_price).toFixed(2)} / N: ${Number(r.no_price).toFixed(2)}`
          : "Y: - / N: -";
      console.log(
        `  ${pad(`[${r.platform}]`, 12)} | ${pad(title, 52)} | ${pad(price, 18)} | ${formatUSD(Number(r.liquidity_usd))}`
      );
    }
  }

  const { count: totalRaw } = await supabase
    .from("raw_markets")
    .select("*", { count: "exact", head: true });

  const { data: aggRows, error: aggErr } = await supabase
    .from("aggregated_markets")
    .select("*")
    .order("total_liquidity", { ascending: false });

  console.log("\n--- Summary ---\n");
  console.log(`  raw_markets total:        ${totalRaw ?? "?"} rows`);
  console.log(`  aggregated_markets total: ${aggRows?.length ?? (aggErr ? `error: ${aggErr.message}` : "0")} rows`);

  if (aggRows && aggRows.length > 0) {
    console.log("\n  Aggregated groups:");
    for (const a of aggRows) {
      console.log(`    "${a.canonical_title}"`);
      console.log(
        `      Weighted: Y ${Number(a.weighted_yes_price).toFixed(2)} / N ${Number(a.weighted_no_price).toFixed(2)} | Liquidity: ${formatUSD(Number(a.total_liquidity))} | Platforms: ${a.platform_count}`
      );
    }
  }

  console.log("\n  Supabase sync complete.\n");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
