import { useState } from "react";
import { useAccount } from "wagmi";
import { parseUnits } from "viem";
import { useVault } from "../hooks/useVault";

function formatUSD(val: string): string {
  const n = parseFloat(val);
  if (isNaN(n)) return "$0.00";
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `$${(n / 1_000).toFixed(1)}K`;
  return `$${n.toFixed(2)}`;
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-surface rounded-lg px-3 py-2">
      <p className="text-[10px] text-text-muted uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold tabular-nums mt-0.5">{value}</p>
    </div>
  );
}

export function VaultPanel() {
  const { address, isConnected } = useAccount();
  const vault = useVault(address);
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawShares, setWithdrawShares] = useState("");
  const [expanded, setExpanded] = useState(false);

  const needsApproval =
    depositAmount &&
    vault.allowance < parseUnits(depositAmount || "0", 18);

  const isBusy = vault.isApproving || vault.isDepositing || vault.isWithdrawing;

  return (
    <div className="bg-surface-raised border border-border rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-surface-hover transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-accent font-bold">Requiem Vault</span>
          <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded">
            BNB Chain
          </span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-text-muted">
            TVL: {formatUSD(vault.totalPooled)}
          </span>
          <svg
            className={`w-4 h-4 text-text-muted transition-transform ${expanded ? "rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-border px-4 py-4">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
            <StatCard label="Total Pooled" value={formatUSD(vault.totalPooled)} />
            <StatCard label="Total Profit" value={formatUSD(vault.totalProfit)} />
            <StatCard label="Share Price" value={`$${parseFloat(vault.pricePerShare).toFixed(4)}`} />
            <StatCard
              label="Your Points"
              value={isConnected ? vault.userPoints : "--"}
            />
          </div>

          {isConnected ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs text-text-muted mb-1">
                <span>Your Shares: {parseFloat(vault.userShares).toFixed(4)}</span>
                <span>USDT Balance: {parseFloat(vault.tokenBalance).toFixed(2)}</span>
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Amount to deposit"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                  className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                  min="0"
                  step="any"
                />
                {needsApproval ? (
                  <button
                    onClick={() => vault.approve(depositAmount)}
                    disabled={isBusy || !depositAmount}
                    className="text-xs bg-warning/15 text-warning border border-warning/30 rounded-lg px-4 py-2 hover:bg-warning/25 transition-colors disabled:opacity-50 font-medium whitespace-nowrap"
                  >
                    {vault.isApproving ? "Approving..." : "Approve USDT"}
                  </button>
                ) : (
                  <button
                    onClick={() => {
                      vault.deposit(depositAmount);
                      setDepositAmount("");
                    }}
                    disabled={isBusy || !depositAmount}
                    className="text-xs bg-positive/15 text-positive border border-positive/30 rounded-lg px-4 py-2 hover:bg-positive/25 transition-colors disabled:opacity-50 font-medium"
                  >
                    {vault.isDepositing ? "Depositing..." : "Deposit"}
                  </button>
                )}
              </div>

              <div className="flex gap-2">
                <input
                  type="number"
                  placeholder="Shares to withdraw"
                  value={withdrawShares}
                  onChange={(e) => setWithdrawShares(e.target.value)}
                  className="flex-1 bg-surface border border-border rounded-lg px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:outline-none focus:border-accent/50"
                  min="0"
                  step="any"
                />
                <button
                  onClick={() => {
                    vault.withdraw(withdrawShares);
                    setWithdrawShares("");
                  }}
                  disabled={isBusy || !withdrawShares}
                  className="text-xs bg-negative/15 text-negative border border-negative/30 rounded-lg px-4 py-2 hover:bg-negative/25 transition-colors disabled:opacity-50 font-medium"
                >
                  {vault.isWithdrawing ? "Withdrawing..." : "Withdraw"}
                </button>
              </div>
            </div>
          ) : (
            <p className="text-xs text-text-muted text-center py-4">
              Connect your wallet to deposit and earn from pooled arbitrage.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
