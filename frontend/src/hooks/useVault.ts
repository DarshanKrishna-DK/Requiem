import { useReadContract, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { parseUnits, formatUnits } from "viem";
import { VAULT_ABI, VAULT_ADDRESS, ERC20_ABI, STABLECOIN_ADDRESS } from "../lib/contracts";

export function useVault(userAddress: `0x${string}` | undefined) {
  const { data: totalPooled } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "totalPooled",
  });

  const { data: totalShares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "totalShares",
  });

  const { data: totalProfit } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "totalProfitAccumulated",
  });

  const { data: pricePerShare } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "pricePerShare",
  });

  const { data: userShares } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "sharesOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  });

  const { data: userPoints } = useReadContract({
    address: VAULT_ADDRESS,
    abi: VAULT_ABI,
    functionName: "pointsOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  });

  const { data: tokenBalance } = useReadContract({
    address: STABLECOIN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "balanceOf",
    args: userAddress ? [userAddress] : undefined,
    query: { enabled: !!userAddress },
  });

  const { data: allowance } = useReadContract({
    address: STABLECOIN_ADDRESS,
    abi: ERC20_ABI,
    functionName: "allowance",
    args: userAddress ? [userAddress, VAULT_ADDRESS] : undefined,
    query: { enabled: !!userAddress },
  });

  const { writeContract: writeApprove, data: approveTxHash } = useWriteContract();
  const { writeContract: writeDeposit, data: depositTxHash } = useWriteContract();
  const { writeContract: writeWithdraw, data: withdrawTxHash } = useWriteContract();

  const { isLoading: isApproving } = useWaitForTransactionReceipt({ hash: approveTxHash });
  const { isLoading: isDepositing } = useWaitForTransactionReceipt({ hash: depositTxHash });
  const { isLoading: isWithdrawing } = useWaitForTransactionReceipt({ hash: withdrawTxHash });

  function approve(amount: string, decimals = 18) {
    writeApprove({
      address: STABLECOIN_ADDRESS,
      abi: ERC20_ABI,
      functionName: "approve",
      args: [VAULT_ADDRESS, parseUnits(amount, decimals)],
    });
  }

  function deposit(amount: string, decimals = 18) {
    writeDeposit({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "deposit",
      args: [parseUnits(amount, decimals)],
    });
  }

  function withdraw(shares: string, decimals = 18) {
    writeWithdraw({
      address: VAULT_ADDRESS,
      abi: VAULT_ABI,
      functionName: "withdraw",
      args: [parseUnits(shares, decimals)],
    });
  }

  const fmt = (val: bigint | undefined, decimals = 18) =>
    val !== undefined ? formatUnits(val, decimals) : "0";

  return {
    totalPooled: fmt(totalPooled),
    totalShares: fmt(totalShares),
    totalProfit: fmt(totalProfit),
    pricePerShare: fmt(pricePerShare),
    userShares: fmt(userShares),
    userPoints: userPoints?.toString() ?? "0",
    tokenBalance: fmt(tokenBalance),
    allowance: allowance ?? 0n,
    approve,
    deposit,
    withdraw,
    isApproving,
    isDepositing,
    isWithdrawing,
  };
}
