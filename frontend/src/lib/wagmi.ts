import { http, createConfig } from "wagmi";
import { bscTestnet, bsc } from "wagmi/chains";
import { injected } from "wagmi/connectors";

export const config = createConfig({
  chains: [bscTestnet, bsc],
  connectors: [injected()],
  transports: {
    [bscTestnet.id]: http(),
    [bsc.id]: http(),
  },
});

declare module "wagmi" {
  interface Register {
    config: typeof config;
  }
}
