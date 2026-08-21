# Attestcoin integration

This document describes the implemented protocol boundary. It distinguishes official-protocol proof
evidence from ChargeProof-owned deployment evidence.

## Verified network and package values

| Item                        | Current value                                   |
| --------------------------- | ----------------------------------------------- |
| SDK                         | `@gluwa/usc-sdk@0.18.0`                         |
| Solidity helpers            | `@gluwa/usc-contracts@0.2.0`                    |
| Source chain                | Ethereum Sepolia, chain ID `11155111`           |
| Attestcoin source chain key | `1`                                             |
| Source encoding             | EVM V1, value `1`                               |
| Destination                 | Creditcoin Testnet, chain ID `102031`           |
| Chain Info precompile       | `0x0000000000000000000000000000000000000FD3`    |
| Block Prover precompile     | `0x0000000000000000000000000000000000000FD2`    |
| Proof service               | `https://prover.cc3-testnet.creditcoin.network` |

The values were cross-checked against current official documentation, the official example repository
at commit `4ff9a3bf5d7fa8dbfec34ae9726d3f81405dca7b`, installed package source, and live read-only calls.

## Exact source transaction

The only accepted call is:

```solidity
ChargingSessionRegistry.finalizeSession(ChargingReceipt receipt, bytes deviceSignature)
```

The verifier derives the selector from that exact tuple signature; it does not accept event data,
arbitrary contract calls, or a configurable selector. The Attestcoin EVM V1 transaction encoding
contains the common transaction fields and receipt fields used by `EvmV1Decoder`.

The source registry validates the receipt before producing a successful transaction. The destination
does not merely trust that execution: it repeats critical validations so settlement is bound directly
to verified bytes.

## SDK flow

`services/attestation-worker/src/live-ports.ts` uses:

```ts
const chainInfoProvider = new chainInfo.PrecompileChainInfoProvider(creditcoinProvider);
const builder = new proofProvider.service.ProofBuilder(1, proofBuilderUrl, 30_000);
const result = await builder.getProof(transactionHash);
const prover = new blockProver.PrecompileBlockProver(creditcoinProvider);
const valid = await prover.verifySingle(
  proof.chainKey,
  proof.headerNumber,
  proof.txBytes,
  proof.merkleProof,
  proof.continuityProof,
);
```

The worker first requires a mined Sepolia transaction with receipt status `1`. If a canonical registry
is configured, it also rejects a different `to` address or undecodable/non-`finalizeSession` calldata.
It then queries both:

- the latest on-chain attested height via the Chain Info precompile; and
- the proof service's `/api/v1/attested-height/1` height.

Proof generation begins only when both heights are strictly above the source block. This conservative
`N + 1` rule matches the observed protocol finalization boundary and avoids treating the currently
open attestation interval as finalized. There is no promised wall-clock duration.

## Proof components

The SDK returns and the worker persists:

- `chainKey`
- `headerNumber`
- `txIndex` and `txHash` for diagnostics
- `txBytes`, the encoded EVM V1 transaction plus receipt data
- Merkle proof: `root` and ordered `{ hash, isLeft }` siblings
- continuity proof: `lowerEndpointDigest` and ordered roots
- cache/generation metadata

The full proof is schema-validated with Zod and stored atomically in a per-transaction JSON file. A
reload or new process resumes from the source hash rather than regenerating completed work.

The credentialed `pnpm testnet:gate2` runner composes this same worker without bypassing any boundary.
It persists the source hash before polling, calls `submitReadyProof` only after live `verifySingle`
success, and then broadcasts the same proof with an explicit gas limit so the replay rejection is
mined and explorer-verifiable rather than remaining only a failed gas estimate.

## Block Prover call

The target contract implements the current official `INativeQueryVerifier` interface. It constructs
the helper structs and calls:

```solidity
blockProver.verifyAndEmit(
    proof.chainKey,
    proof.blockHeight,
    proof.encodedTransaction,
    merkleProof,
    continuityProof
);
```

Before the state-changing call it uses `calculateTxIndex(merkleProof)` for the replay key. The worker's
read-only `verifySingle` is a readiness diagnostic, not a substitute for target-chain verification.
The constructor additionally requires the canonical `0x…0FD2` address whenever `block.chainid` is
Creditcoin Testnet.

## Decoding and business validation

After `verifyAndEmit` succeeds, `EvmV1Decoder` is used to:

1. reject unsupported transaction types;
2. require source receipt status `1`;
3. recover common `from`, `to`, and `data` fields;
4. require the exact Sepolia registry;
5. require the exact `finalizeSession` selector;
6. ABI-decode the complete receipt and device signature;
7. require recovered source `from` to equal the receipt and escrow driver.

The verifier then loads the funded intent and checks active state, chain/registry binding, driver,
station, tariff, session window, expiry, deterministic session ID, ceiling-rounded amount, maximum
escrow, receipt start relative to intent creation, and the EIP-712 device signature against the signer
snapshotted at intent creation.

## Replay protection

Three independent mappings are consumed before calling escrow:

- source transaction position: `keccak256(chainKey, blockHeight, calculatedTxIndex)`;
- settlement binding: `keccak256(sourceTransactionKey, intentId)`;
- deterministic `sessionId`.

The source contract separately consumes both `sessionId` and `(stationId, deviceNonce)`. Escrow terminal
states provide another state-machine barrier.

## Gate 1 real evidence

The smallest current official Sepolia-to-Creditcoin flow was reproduced without signing:

- Source transaction:
  `0xce785c35e300d607d83da9564990c4d2aaf45dafc68ef76539d97aee3de6859b`
- Source block/index/status: `11073054` / `216` / `1`
- Generated proof: 1,920 encoded transaction bytes, 8 Merkle siblings, 47 continuity roots
- Live `PrecompileBlockProver.verifySingle`: `true`
- Official target transaction:
  `0x7cc3a7333e9522f5921e6430bd59192caf7e1ce2382ae022879da93cd4ae9388`, status `1`

This establishes current SDK/proof/precompile compatibility. It is explicitly **not** a ChargeProof
receipt or settlement. A project-owned source transaction and target settlement remain blocked on
funded burner-wallet signatures and will be placed in `submission/EVIDENCE.md` only after confirmation.

## Mock versus live boundary

- Contract unit tests use the real official decoder and verifier interface, but replace only `0xFD2`
  with `MockNativeQueryVerifier` so arbitrary encoded fixtures can be exercised locally.
- Worker unit tests replace RPC/prover ports, not its state machine.
- Gate 1 used the live Sepolia RPC, proof service, Creditcoin Chain Info, and Block Prover.
- The dashboard's “Local simulation” is visibly labeled and never produces fake hashes or explorer
  links.
- Testnet mode is enabled only when complete deployment addresses are configured.

## Official references

- [Attestcoin Protocol overview](https://docs.creditcoin.org/usc)
- [Architecture](https://docs.creditcoin.org/usc/architecture)
- [Supported chains and environments](https://docs.creditcoin.org/usc/usc-chains-environments)
- [SDK](https://docs.creditcoin.org/usc/dapp-builder-infrastructure/usc-sdk)
- [Smart contracts](https://docs.creditcoin.org/usc/dapp-builder-infrastructure/usc-smart-contracts)
- [Guided tutorials](https://docs.creditcoin.org/usc/guided-tutorials)
- [Official example repository](https://github.com/gluwa/usc-testnet-bridge-examples)
