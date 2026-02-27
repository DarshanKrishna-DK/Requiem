import { useAccount, useConnect, useDisconnect } from "wagmi";

export function WalletConnect() {
  const { address, isConnected, chain } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();

  if (isConnected && address) {
    const shortAddr = `${address.slice(0, 6)}...${address.slice(-4)}`;
    return (
      <div className="flex items-center gap-2">
        {chain && (
          <span className="text-[10px] text-text-muted bg-surface-raised border border-border rounded px-1.5 py-0.5">
            {chain.name}
          </span>
        )}
        <span className="text-xs text-accent font-mono">{shortAddr}</span>
        <button
          onClick={() => disconnect()}
          className="text-[11px] text-text-muted hover:text-negative transition-colors"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => {
        const injected = connectors.find((c) => c.id === "injected");
        if (injected) connect({ connector: injected });
      }}
      className="text-xs bg-accent/15 text-accent border border-accent/30 rounded-lg px-3 py-1.5 hover:bg-accent/25 transition-colors font-medium"
    >
      Connect Wallet
    </button>
  );
}
