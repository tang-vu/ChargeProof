# Research log

Research date: 2026-08-21. Network and package data can change; rerun the diagnostics before deployment.

## Official sources reviewed

- [BUIDL CTC 2026 Fall](https://dorahacks.io/hackathon/buidl-ctc-2026-fall/detail)
- [Attestcoin / USC architecture](https://docs.creditcoin.org/usc/overview/usc-architecture-overview)
- [Universal Smart Contracts](https://docs.creditcoin.org/usc/dapp-builder-infrastructure/universal-smart-contracts)
- [USC v2 migration guide](https://docs.creditcoin.org/usc/migration-guide)
- [Creditcoin endpoints](https://docs.creditcoin.org/smart-contract-guides/creditcoin-endpoints)
- [Official bridge examples](https://github.com/gluwa/usc-testnet-bridge-examples)
- npm packages `@gluwa/usc-sdk@0.18.0` and `@gluwa/usc-contracts@0.2.0`

The hackathon page uses the Attestcoin name; current technical packages and parts of the documentation
still use USC. These names refer to the same protocol generation for this project.

## Verified protocol conclusions

1. The Creditcoin Testnet Block Prover is the native precompile at `0x0000000000000000000000000000000000000FD2`.
2. `verify` and `verifyAndEmit` accept a `uint64 chainKey`, source block height, SDK-encoded transaction,
   binary Merkle proof, and continuity proof. The ABI is copied from the current official contract package.
3. A valid proof establishes transaction inclusion in an attested source-chain history. It does **not**
   establish successful EVM execution. ChargeProof therefore decodes and requires receipt status `1`.
4. The encoded EVM transaction contains common transaction fields and receipt data. The current
   `EvmV1Decoder` exposes `from`, `to`, calldata, receipt status, and logs.
5. Sepolia is live under chain key `1` on Creditcoin Testnet. The Chain Info precompile returned native
   chain ID `11155111` and encoding version `1` during the research session.
6. The current proof API path is `/api/v1/proof-by-tx/{chainKey}/{transactionHash}`. The official example
   constructs `proofProvider.service.ProofBuilder` and calls `waitUntilHeightAttested` then `getProof`.
7. The official examples use `https://prover.cc3-testnet.creditcoin.network`. The provisional
   `https://proof-gen-api.cc3-testnet.creditcoin.network` was also healthy and served the same health
   response, but ChargeProof uses the URL present in current official source.
8. Proof API readiness can lag on-chain attestation. Persisted state and retriable polling are required;
   a single long serverless request is unsuitable.

## Gate 1 live diagnostic

The official Sepolia example transaction
`0xce785c35e300d607d83da9564990c4d2aaf45dafc68ef76539d97aee3de6859b` is in block `11073054`
with receipt status `1`. On 2026-08-21, `ProofBuilder.getProof` returned a cached proof containing eight
Merkle siblings and 47 continuity roots. `PrecompileBlockProver.verifySingle` against the live Creditcoin
Testnet RPC returned `true`.

The official example's corresponding Creditcoin transaction
`0x7cc3a7333e9522f5921e6430bd59192caf7e1ce2382ae022879da93cd4ae9388` also has receipt status `1`.
This is attributed scaffolding evidence, not ChargeProof deployment evidence and not Gate 2 completion.

## Product implication

ChargeProof proves the exact canonical Sepolia call, then independently checks source chain key, source
contract, caller, selector, decoded receipt, device EIP-712 signature, escrow terms, amount, expiry, and
replay keys on Creditcoin. Attestcoin is indispensable: without the precompile-approved transaction bytes,
the settlement entry point cannot obtain trusted source-chain evidence.
