import { useState, useMemo } from "react";
import { useMarkets } from "./hooks/useMarkets";
import { MarketCard } from "./components/MarketCard";
import { WalletConnect } from "./components/WalletConnect";
import { VaultPanel } from "./components/VaultPanel";
import type { Platform } from "./lib/types";
import { PLATFORM_CONFIG } from "./lib/types";

type SortKey = "liquidity" | "expiry" | "price";

function App() {
  const { markets, loading, error, lastUpdated, refresh } = useMarkets();
  const [search, setSearch] = useState("");
  const [platformFilter, setPlatformFilter] = useState<Platform | "all">("all");
  const [sortBy, setSortBy] = useState<SortKey>("liquidity");
  const [refreshing, setRefreshing] = useState(false);

  const filtered = useMemo(() => {
    let result = markets;

    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((m) => m.title.toLowerCase().includes(q));
    }

    if (platformFilter !== "all") {
      result = result.filter((m) =>
        m.platforms.some((p) => p.platform === platformFilter)
      );
    }

    result = [...result].sort((a, b) => {
      if (sortBy === "liquidity") return b.totalLiquidity - a.totalLiquidity;
      if (sortBy === "expiry") {
        const ea = a.expiry ? new Date(a.expiry).getTime() : Infinity;
        const eb = b.expiry ? new Date(b.expiry).getTime() : Infinity;
        return ea - eb;
      }
      if (sortBy === "price") {
        return (b.weightedYes ?? 0) - (a.weightedYes ?? 0);
      }
      return 0;
    });

    return result;
  }, [markets, search, platformFilter, sortBy]);

  const platformCounts = useMemo(() => {
    const counts: Record<string, number> = { all: markets.length };
    for (const m of markets) {
      for (const p of m.platforms) {
        counts[p.platform] = (counts[p.platform] || 0) + 1;
      }
    }
    return counts;
  }, [markets]);

  async function handleRefresh() {
    setRefreshing(true);
    await refresh();
    setRefreshing(false);
  }

  return (
    <div className="min-h-screen bg-surface">
      <header className="sticky top-0 z-50 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-bold tracking-tight">
                <span className="text-accent">R</span>equiem
              </h1>
              <span className="text-[11px] text-text-muted border border-border rounded px-1.5 py-0.5">
                v1.0
              </span>
            </div>
            <div className="flex items-center gap-3">
              {lastUpdated && (
                <span className="text-[11px] text-text-muted">
                  Updated{" "}
                  {lastUpdated.toLocaleTimeString("en-US", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              )}
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                className="text-xs bg-surface-raised border border-border rounded-lg px-3 py-1.5 hover:bg-surface-hover transition-colors disabled:opacity-50"
              >
                {refreshing ? "Syncing..." : "Refresh"}
              </button>
              <WalletConnect />
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              <input
                type="text"
                placeholder="Search markets... (e.g. Bitcoin, NBA, Arsenal)"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-surface-raised border border-border rounded-lg pl-10 pr-4 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50 focus:ring-1 focus:ring-accent/20 transition-all"
              />
            </div>

            <div className="flex gap-2">
              {(["all", "predict", "probable", "xo", "polymarket"] as const).map((key) => {
                const isActive = platformFilter === key;
                const count = platformCounts[key] || 0;
                const label =
                  key === "all"
                    ? "All"
                    : PLATFORM_CONFIG[key as Platform].label;
                const colorClass =
                  key !== "all" && isActive
                    ? PLATFORM_CONFIG[key as Platform].color
                    : "";

                return (
                  <button
                    key={key}
                    onClick={() => setPlatformFilter(key)}
                    className={`text-xs px-3 py-2 rounded-lg border transition-all whitespace-nowrap ${
                      isActive
                        ? "bg-surface-hover border-border-bright text-text-primary"
                        : "bg-surface-raised border-border text-text-muted hover:text-text-secondary"
                    } ${colorClass}`}
                  >
                    {label}{" "}
                    <span className="opacity-60">({count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="flex gap-2 mt-3">
            {(
              [
                ["liquidity", "Liquidity"],
                ["expiry", "Expiring Soon"],
                ["price", "Highest Price"],
              ] as [SortKey, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setSortBy(key)}
                className={`text-[11px] px-2.5 py-1 rounded-md transition-all ${
                  sortBy === key
                    ? "bg-accent/15 text-accent"
                    : "text-text-muted hover:text-text-secondary"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className="mb-6">
          <VaultPanel />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-accent/30 border-t-accent rounded-full animate-spin" />
              <span className="text-sm text-text-muted">
                Loading markets...
              </span>
            </div>
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <p className="text-negative text-sm mb-2">
              Failed to load markets
            </p>
            <p className="text-text-muted text-xs">{error}</p>
            <button
              onClick={handleRefresh}
              className="mt-4 text-xs text-accent underline"
            >
              Try again
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-text-secondary text-sm">No markets found</p>
            <p className="text-text-muted text-xs mt-1">
              {search
                ? "Try a different search term"
                : "No data available yet"}
            </p>
          </div>
        ) : (
          <>
            <div className="flex items-center justify-between mb-4">
              <p className="text-xs text-text-muted">
                Showing {filtered.length} of {markets.length} markets
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((m) => (
                <MarketCard key={m.id} market={m} />
              ))}
            </div>
          </>
        )}
      </main>

      <footer className="border-t border-border py-6 mt-8">
        <div className="max-w-7xl mx-auto px-4 flex items-center justify-between text-[11px] text-text-muted">
          <span>Requiem — Aggregated Liquidity, Zero Friction</span>
          <span>
            Data from Predict.fun, Probable, XO Market, Polymarket
          </span>
        </div>
      </footer>
    </div>
  );
}

export default App;
