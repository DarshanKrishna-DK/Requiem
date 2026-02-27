import { ethers } from "hardhat";

// BNB Testnet USDT address (PancakeSwap testnet mock)
const BSC_TESTNET_USDT = "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("Deploying with account:", deployer.address);

  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Account balance:", ethers.formatEther(balance), "BNB\n");

  const stablecoinAddress = process.env.STABLECOIN_ADDRESS || BSC_TESTNET_USDT;
  console.log("Using stablecoin at:", stablecoinAddress);

  // Deploy RequiemVault
  console.log("\n1. Deploying RequiemVault...");
  const Vault = await ethers.getContractFactory("RequiemVault");
  const vault = await Vault.deploy(stablecoinAddress);
  await vault.waitForDeployment();
  const vaultAddress = await vault.getAddress();
  console.log("   RequiemVault deployed to:", vaultAddress);

  // Deploy ArbitrageRouter
  console.log("\n2. Deploying ArbitrageRouter...");
  const Router = await ethers.getContractFactory("ArbitrageRouter");
  const router = await Router.deploy();
  await router.waitForDeployment();
  const routerAddress = await router.getAddress();
  console.log("   ArbitrageRouter deployed to:", routerAddress);

  // Wire them together
  console.log("\n3. Wiring: vault.setRouter(router)...");
  const tx = await vault.setRouter(routerAddress);
  await tx.wait();
  console.log("   Router set on vault.");

  console.log("\n=== Deployment Complete ===");
  console.log("  RequiemVault:", vaultAddress);
  console.log("  ArbitrageRouter:", routerAddress);
  console.log("  Stablecoin:", stablecoinAddress);
  console.log("\nSave these addresses in your frontend .env:");
  console.log(`  VITE_VAULT_ADDRESS=${vaultAddress}`);
  console.log(`  VITE_ROUTER_ADDRESS=${routerAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
