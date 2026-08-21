# ChargeProof execution plan

Last updated: 2026-08-21

## Gate 1 — official proof spike

- [x] Inspect official docs, npm packages, and `gluwa/usc-testnet-bridge-examples` at commit
      `4ff9a3bf5d7fa8dbfec34ae9726d3f81405dca7b`.
- [x] Verify live Creditcoin chain info: Sepolia chain key `1`, chain ID `11155111`.
- [x] Regenerate a real proof for the official Sepolia example transaction.
- [x] Verify the proof through the live Creditcoin Testnet Block Prover precompile using `eth_call`.
- [ ] Send a new ChargeProof-owned Sepolia transaction (blocked until a funded burner signs).

## Gate 2 — ChargeProof vertical slice

- [x] Compile and test the canonical Sepolia session registry.
- [x] Compile and test Creditcoin escrow, proof verifier, station registry, and MockUSDC.
- [x] Finish the idempotent proof state machine and CLI.
- [x] Add a resumable credentialed Gate 2 runner covering deploy, intent, source receipt, proof,
      settlement, replay failure, metrics, and machine-readable evidence.
- [x] Pass the local end-to-end flow with the accurate precompile mock.
- [ ] Deploy to both testnets and record one successful settlement plus one rejected replay.

## Product and submission

- [x] Complete the responsive dashboard and browser resumability.
- [x] Complete threat model, operations docs, and troubleshooting.
- [x] Complete README, deck, video runbook, judging matrix, submission copy, and checklist.
- [x] Run all credential-free quality gates.
- [x] Publish the repository, pass clean-runner CI, render the deck PDF, and deploy the truth-labeled
      dashboard to Vercel.

## Architecture decisions

Use one pnpm monorepo and one Hardhat toolchain across two contract packages. Pin Solidity `0.8.28`
because the current `@gluwa/usc-contracts@0.2.0` decoder uses that pragma. The proof worker uses the
official SDK (which currently retains the USC package name) behind a small domain-specific adapter.
The web app uses viem/wagmi; the worker uses ethers only where required by the SDK.
