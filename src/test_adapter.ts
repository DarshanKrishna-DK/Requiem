import { fetchPredictMarkets } from "./fetchers/predict.js";
import { fetchProbableMarkets } from "./fetchers/probable.js";
import { fetchXOMarkets } from "./fetchers/xo.js";
import { adaptAll, sanitizeTitle } from "./adapters/market-adapter.js";
import type { FetcherResult, Market, Platform } from "./types/market.js";

function formatExpiry(date: Date): string {
  return date.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

async function main() {
  console.log("\n=== Requiem Phase 2: Ingestion Adapter ===\n");

  const results = await Promise.allSettled([
    fetchPredictMarkets(),
    fetchProbableMarkets(),
    fetchXOMarkets(),
  ]);

  const platforms: Platform[] = ["predict", "probable", "xo"];
  const fetched: FetcherResult[] = results.map((r, i) => {
    if (r.status === "fulfilled") return r.value;
    return {
      platform: platforms[i],
      markets: [],
      skipped: false,
      error: r.reason instanceof Error ? r.reason.message : String(r.reason),
    };
  });

  const rawMarkets = fetched.flatMap((f) => f.markets);
  const markets = adaptAll(rawMarkets);

  markets.sort((a, b) => b.liquidity - a.liquidity);

  console.log("--- Unified Markets (liquidity > $500, all fields present) ---\n");

  if (markets.length === 0) {
    console.log("  No markets passed the filter.\n");
  } else {
    for (const m of markets) {
      const platform = pad(`[${m.platform}]`, 12);
      const title =
        m.title.length > 55 ? m.title.slice(0, 52) + "..." : m.title;
      const price = `Y: ${m.yes_price.toFixed(2)} / N: ${m.no_price.toFixed(2)}`;
      const liq = formatUSD(m.liquidity);

      console.log(
        `${platform} | ${pad(title, 57)} | ${pad(price, 18)} | ${pad(liq, 10)} | ${formatExpiry(m.expiry)}`
      );
    }
  }

  console.log("\n--- Sanitized Titles (sample, first 10) ---\n");

  for (const m of markets.slice(0, 10)) {
    console.log(`  Original:  ${m.title}`);
    console.log(`  Sanitized: ${sanitizeTitle(m.title)}`);
    console.log();
  }

  console.log("--- Adapter Summary ---\n");

  for (const p of platforms) {
    const rawCount = rawMarkets.filter((r) => r.platform === p).length;
    const adaptedCount = markets.filter((m) => m.platform === p).length;
    const dropped = rawCount - adaptedCount;
    console.log(
      `  ${pad(p + ":", 12)} ${rawCount} raw → ${adaptedCount} adapted (${dropped} dropped)`
    );
  }

  console.log(
    `\n  Total:       ${rawMarkets.length} raw → ${markets.length} adapted markets\n`
  );
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
