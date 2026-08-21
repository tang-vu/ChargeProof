# Local development

## Prerequisites

- Node.js 24.x
- pnpm 11
- Git

The repository uses one pnpm lockfile, Hardhat 3, Solidity 0.8.28, TypeScript strict mode, Next.js App
Router, viem/wagmi, and Vitest. Foundry is intentionally not required.

## Install and validate

```bash
pnpm install --frozen-lockfile
pnpm compile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm secret:scan
```

No wallet or private key is required for these commands. Creditcoin contract tests replace only the
native query-verifier boundary with an accurate Solidity mock; they still exercise real EVM V1
decoding, full calldata binding, device signatures, escrow accounting, and replay state.

## Run the dashboard

```bash
pnpm --filter @chargeproof/web dev
```

Open `http://localhost:3000`. Without deployment addresses the header and workflow state explicitly
show **Local simulation**. This mode animates the product explanation but does not display invented
wallet connections, transaction hashes, proofs, contract addresses, or explorer evidence.

To test server-side device signing safely, generate an ephemeral testnet-only private key outside the
repository and place it in an ignored `apps/web/.env.local` as `DEVICE_SIMULATOR_PRIVATE_KEY`. Its
corresponding address must be the device signer registered on both chains. Never use a funded mainnet
wallet.

## Resumable proof CLI

The CLI observes one source transaction and advances at most one idempotent state transition:

```bash
pnpm proof:resume -- 0xSOURCE_TRANSACTION_HASH
```

Repeat the same command after attestation advances. State is written under the ignored
`services/attestation-worker/worker-state/` directory with restrictive file permissions and atomic
replacement. Options can override state directory and RPC/prover URLs; run with `--help` for the
current syntax.

Proof submission is a separate command path and requires a Creditcoin testnet gas payer. The proof
itself is public and settlement is permissionless.

## Automated project-owned testnet flow

After `pnpm wallets:status` reports gas on both testnets, run:

```bash
pnpm testnet:gate2
```

This credentialed command deploys both contract stacks if necessary and then resumes one persisted
run in `worker-state/gate2.json`. Transaction hashes are saved immediately. Completion writes only
public data to `deployments/gate2-evidence.json`, including explorer URLs, proof counts, settlement
accounting, metrics, and the reverted replay receipt. Neither key is written to worker state or
evidence.

## Package commands

```bash
pnpm --filter @chargeproof/contracts-sepolia test
pnpm --filter @chargeproof/contracts-creditcoin test
pnpm --filter @chargeproof/attestation-worker test
pnpm --filter @chargeproof/shared test
pnpm --filter @chargeproof/web test
```

Contract artifacts and generated Hardhat types are build outputs and are not committed.

## Environment safety

Copy `.env.example` to an ignored root `.env` for deployment/worker commands and copy only the web
variables to `apps/web/.env.local`. Public `NEXT_PUBLIC_*` variables are
delivered to browsers; private keys must never use that prefix. The device signing endpoint reads its
key only on the server, validates the receipt first, and fails closed when the key is absent.
