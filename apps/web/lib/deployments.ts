import { getAddress, isAddress, type Address } from 'viem';

type PublicDeployments = {
  sepoliaRegistry: Address | undefined;
  escrow: Address | undefined;
  verifier: Address | undefined;
  stationRegistry: Address | undefined;
  mockUsdc: Address | undefined;
};

function optionalAddress(value: string | undefined): Address | undefined {
  return value && isAddress(value) ? getAddress(value) : undefined;
}

export const deployments: PublicDeployments = {
  sepoliaRegistry: optionalAddress(process.env.NEXT_PUBLIC_SEPOLIA_REGISTRY_ADDRESS),
  escrow: optionalAddress(process.env.NEXT_PUBLIC_CREDITCOIN_ESCROW_ADDRESS),
  verifier: optionalAddress(process.env.NEXT_PUBLIC_CREDITCOIN_VERIFIER_ADDRESS),
  stationRegistry: optionalAddress(process.env.NEXT_PUBLIC_CREDITCOIN_STATION_REGISTRY_ADDRESS),
  mockUsdc: optionalAddress(process.env.NEXT_PUBLIC_CREDITCOIN_MOCK_USDC_ADDRESS),
};

export const liveDeploymentReady = Boolean(
  deployments.sepoliaRegistry &&
  deployments.escrow &&
  deployments.verifier &&
  deployments.stationRegistry &&
  deployments.mockUsdc,
);
