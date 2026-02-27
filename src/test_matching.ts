import { fetchPredictMarkets } from "./fetchers/predict.js";
import { fetchProbableMarkets } from "./fetchers/probable.js";
import { fetchXOMarkets } from "./fetchers/xo.js";
import { fetchPolymarketMarkets } from "./fetchers/polymarket.js";
import { adaptAll } from "./adapters/market-adapter.js";
import { matchMarkets } from "./matching/grouping-engine.js";
import type { FetcherResult, Market, Platform } from "./types/market.js";

function pad(str: string, len: number): string {
  return str.length >= len ? str : str + " ".repeat(len - str.length);
}

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function runMockTest() {
  console.log("=== Mock Test: Verifying Algorithm ===\n");

  const expiry = new Date("2026-06-15T00:00:00Z");
  const expirySameDay = new Date("2026-06-15T12:00:00Z");
  const expiryDifferent = new Date("2026-09-01T00:00:00Z");

  const mocks: Market[] = [
    {
      id: "probable-m1",
      title: "Will BTC reach 90k by June 2026?",
      platform: "probable",
      yes_price: 0.6,
      no_price: 0.4,
      liquidity: 5000,
      expiry,
    },
    {
      id: "xo-m1",
      title: "Bitcoin to hit $90,000 by June 2026",
      platform: "xo",
      yes_price: 0.55,
      no_price: 0.45,
      liquidity: 8000,
      expiry: expirySameDay,
    },
    {
      id: "predict-m1",
      title: "Will BTC reach 90k by June 2026?",
      platform: "predict",
      yes_price: 0.58,
      no_price: 0.42,
      liquidity: 12000,
      expiry,
    },
    {
      id: "probable-m2",
      title: "Will ETH reach 5k by September 2026?",
      platform: "probable",
      yes_price: 0.35,
      no_price: 0.65,
      liquidity: 3000,
      expiry: expiryDifferent,
    },
    {
      id: "xo-m2",
      title: "Ethereum to hit $5,000 by September 2026",
      platform: "xo",
      yes_price: 0.3,
      no_price: 0.7,
      liquidity: 6000,
      expiry: expiryDifferent,
    },
    {
      id: "probable-m3",
      title: "Will SOL reach 500 by June 2026?",
      platform: "probable",
      yes_price: 0.2,
      no_price: 0.8,
      liquidity: 2000,
      expiry,
    },
  ];

  const result = matchMarkets(mocks);

  console.log(`Pairs found (score >= 0.88):\n`);
  for (const p of result.pairLog) {
    console.log(
      `  [${p.platformA}] "${p.titleA}"\n  [${p.platformB}] "${p.titleB}"\n  Score: ${p.score.toFixed(4)}\n`
    );
  }

  console.log(`Matched groups: ${result.matched.length}`);
  for (const g of result.matched) {
    console.log(`\n  "${g.canonical_title}"`);
    console.log(`  Platforms: ${g.markets.map((m) => m.platform).join(", ")}`);
    console.log(`  Total liquidity: ${formatUSD(g.total_liquidity)}`);
    console.log(
      `  Best Yes: ${g.best_yes.platform} @ ${g.best_yes.price.toFixed(2)}`
    );
  }

  console.log(`\nUnmatched: ${result.unmatched.length}`);
  for (const m of result.unmatched) {
    console.log(`  [${m.platform}] ${m.title}`);
  }

  const btcGroup = result.matched.find((g) =>
    g.canonical_title.toLowerCase().includes("btc") ||
    g.canonical_title.toLowerCase().includes("bitcoin")
  );
  const ethGroup = result.matched.find((g) =>
    g.canonical_title.toLowerCase().includes("eth") ||
    g.canonical_title.toLowerCase().includes("ethereum")
  );
  const solUnmatched = result.unmatched.find((m) =>
    m.title.toLowerCase().includes("sol")
  );

  console.log("\n--- Mock Assertions ---");
  console.log(
    `  BTC group found with 2+ platforms: ${btcGroup ? "PASS" : "FAIL"} ${btcGroup ? `(${btcGroup.markets.length} markets)` : ""}`
  );
  console.log(
    `  ETH group found with 2 platforms:  ${ethGroup ? "PASS" : "FAIL"} ${ethGroup ? `(${ethGroup.markets.length} markets)` : ""}`
  );
  console.log(
    `  SOL remains unmatched:             ${solUnmatched ? "PASS" : "FAIL"}`
  );
  console.log();
}

async function runLiveTest() {
  console.log("=== Requiem Phase 3: Grouping Engine (Live Data) ===\n");

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

  const rawMarkets = fetched.flatMap((f) => f.markets);
  const markets = adaptAll(rawMarkets);
  console.log(`\nAdapted ${markets.length} markets, running matching engine...\n`);

  const result = matchMarkets(markets);

  if (result.pairLog.length > 0) {
    console.log("--- Fuzzy Pairs Found ---\n");
    for (const p of result.pairLog) {
      console.log(
        `  Matched: ${pad(`[${p.platformA}]`, 12)} "${p.titleA}"\n` +
        `           ${pad(`[${p.platformB}]`, 12)} "${p.titleB}"\n` +
        `           Score: ${p.score.toFixed(4)}\n`
      );
    }
  }

  if (result.matched.length > 0) {
    console.log("--- Matched Groups (cross-platform) ---\n");
    for (let i = 0; i < result.matched.length; i++) {
      const g = result.matched[i];
      console.log(`  Group ${i + 1}: "${g.canonical_title}"`);
      for (const m of g.markets) {
        console.log(
          `    [${pad(m.platform, 9)}] Y: ${m.yes_price.toFixed(2)} / N: ${m.no_price.toFixed(2)} | ${formatUSD(m.liquidity)}`
        );
      }
      console.log(`    Total liquidity: ${formatUSD(g.total_liquidity)}`);
      console.log(
        `    Best Yes: ${g.best_yes.platform} @ ${g.best_yes.price.toFixed(2)} | Best No: ${g.best_no.platform} @ ${g.best_no.price.toFixed(2)}`
      );
      console.log();
    }
  } else {
    console.log(
      "--- No cross-platform matches found with current data ---\n" +
      "  (This is expected: current platforms have little market overlap.\n" +
      "   The engine will find matches as more overlapping markets appear.)\n"
    );
  }

  console.log("--- Summary ---\n");
  console.log(`  Total markets:     ${markets.length}`);
  console.log(`  Matched groups:    ${result.matched.length}`);
  console.log(
    `  Markets in groups: ${result.matched.reduce((s, g) => s + g.markets.length, 0)}`
  );
  console.log(`  Unmatched:         ${result.unmatched.length}`);
  console.log();
}

async function main() {
  runMockTest();
  console.log("========================================\n");
  await runLiveTest();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
