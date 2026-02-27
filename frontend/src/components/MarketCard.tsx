import type { MarketCardData, PlatformDetail } from "../lib/types";
import { PLATFORM_CONFIG } from "../lib/types";

function formatUSD(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(0)}`;
}

function formatExpiry(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  const now = new Date();
  const diff = d.getTime() - now.getTime();
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));

  const dateStr = d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  if (days < 0) return `Expired`;
  if (days === 0) return `Today`;
  if (days === 1) return `Tomorrow`;
  if (days <= 7) return `${days}d left`;
  return dateStr;
}

function PlatformBadge({ platform }: { platform: PlatformDetail }) {
  const cfg = PLATFORM_CONFIG[platform.platform];
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${cfg.bg} ${cfg.color}`}
    >
      {cfg.label}
    </span>
  );
}

function PriceCell({
  price,
  isBest,
  type,
}: {
  price: number;
  isBest: boolean;
  type: "yes" | "no";
}) {
  const base =
    type === "yes"
      ? isBest
        ? "text-positive font-semibold"
        : "text-text-primary"
      : isBest
        ? "text-negative font-semibold"
        : "text-text-primary";

  return (
    <span className={`tabular-nums ${base}`}>
      {price.toFixed(2)}
      {isBest && (
        <span className="ml-1 text-[10px] uppercase tracking-wider opacity-70">
          best
        </span>
      )}
    </span>
  );
}

export function MarketCard({ market }: { market: MarketCardData }) {
  const bestYesPrice = Math.min(...market.platforms.map((p) => p.yes_price));
  const bestNoPrice = Math.min(...market.platforms.map((p) => p.no_price));

  const expiryText = formatExpiry(market.expiry);
  const isExpiringSoon =
    market.expiry &&
    new Date(market.expiry).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000;

  return (
    <div className="group bg-surface-raised border border-border rounded-xl p-4 hover:border-border-bright transition-all duration-200 flex flex-col gap-3">
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-snug text-text-primary line-clamp-2 flex-1">
          {market.isAggregated && (
            <span className="inline-block mr-1.5 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider bg-accent/15 text-accent rounded">
              Multi
            </span>
          )}
          {market.title}
        </h3>
        <span
          className={`text-xs whitespace-nowrap ${isExpiringSoon ? "text-warning font-medium" : "text-text-muted"}`}
        >
          {expiryText}
        </span>
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        {market.platforms.map((p) => (
          <PlatformBadge key={p.market_id ?? p.platform} platform={p} />
        ))}
      </div>

      <div className="border-t border-border pt-3">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-text-muted">
              <th className="text-left font-normal pb-1.5">Platform</th>
              <th className="text-right font-normal pb-1.5">Yes</th>
              <th className="text-right font-normal pb-1.5">No</th>
              <th className="text-right font-normal pb-1.5">Liquidity</th>
            </tr>
          </thead>
          <tbody>
            {market.platforms.map((p) => (
              <tr
                key={p.market_id ?? p.platform}
                className="border-t border-border/50"
              >
                <td className="py-1.5">
                  <span className={PLATFORM_CONFIG[p.platform].color}>
                    {PLATFORM_CONFIG[p.platform].label}
                  </span>
                </td>
                <td className="text-right py-1.5">
                  <PriceCell
                    price={p.yes_price}
                    isBest={
                      market.platforms.length > 1 &&
                      p.yes_price === bestYesPrice
                    }
                    type="yes"
                  />
                </td>
                <td className="text-right py-1.5">
                  <PriceCell
                    price={p.no_price}
                    isBest={
                      market.platforms.length > 1 && p.no_price === bestNoPrice
                    }
                    type="no"
                  />
                </td>
                <td className="text-right py-1.5 text-text-secondary tabular-nums">
                  {formatUSD(p.liquidity)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {market.isAggregated && market.weightedYes !== null && (
        <div className="bg-surface/60 rounded-lg px-3 py-2 text-xs flex justify-between items-center">
          <span className="text-text-muted">Weighted Avg</span>
          <span className="tabular-nums">
            <span className="text-positive">
              Y {market.weightedYes.toFixed(2)}
            </span>
            <span className="text-text-muted mx-1.5">/</span>
            <span className="text-negative">
              N {market.weightedNo?.toFixed(2)}
            </span>
          </span>
        </div>
      )}

      <div className="flex items-center justify-between text-[11px] text-text-muted">
        <span>Total: {formatUSD(market.totalLiquidity)}</span>
        {market.platforms.length > 1 && (
          <span className="text-accent">
            {market.platforms.length} platforms
          </span>
        )}
      </div>
    </div>
  );
}
