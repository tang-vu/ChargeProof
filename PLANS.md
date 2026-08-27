# ChargeProof execution plan

Last updated: 2026-08-26

## Gate 1 — official proof spike

- [x] Inspect official docs, npm packages, and `gluwa/usc-testnet-bridge-examples` at commit
      `4ff9a3bf5d7fa8dbfec34ae9726d3f81405dca7b`.
- [x] Verify live Creditcoin chain info: Sepolia chain key `1`, chain ID `11155111`.
- [x] Regenerate a real proof for the official Sepolia example transaction.
- [x] Verify the proof through the live Creditcoin Testnet Block Prover precompile using `eth_call`.
- [x] Send and prove a new ChargeProof-owned Sepolia transaction.

## Gate 2 — ChargeProof vertical slice

- [x] Compile and test the canonical Sepolia session registry.
- [x] Compile and test Creditcoin escrow, proof verifier, station registry, and MockUSDC.
- [x] Finish the idempotent proof state machine and CLI.
- [x] Add a resumable credentialed Gate 2 runner covering deploy, intent, source receipt, proof,
      settlement, replay failure, metrics, and machine-readable evidence.
- [x] Pass the local end-to-end flow with the accurate precompile mock.
- [x] Deploy to both testnets and record one successful settlement plus one rejected replay.

## Product and submission

- [x] Complete the responsive dashboard and browser resumability.
- [x] Complete threat model, operations docs, and troubleshooting.
- [x] Complete README, deck, video runbook, judging matrix, submission copy, and checklist.
- [x] Run all credential-free quality gates.
- [x] Publish the repository, pass clean-runner CI, render the deck PDF, and deploy the truth-labeled
      dashboard to Vercel.
- [x] Seed the dashboard, deck, runbook, and submission materials with project-owned Gate 2 evidence.
- [x] Build and validate a reproducible 1920×1080 demo-video pipeline with public dashboard/deck
      capture, FFmpeg composition, subtitles, MiMo V2.5 TTS, and MiMo V2.5 ASR quality checks.
- [x] Generate the final narration with a replacement, locally configured MiMo credential; validate
      every scene with MiMo ASR and render the final 2:55 MP4.
- [x] Regenerate the upload candidate with truthful unaudited wording, clearer high-WER scenes,
      normalized loudness, refreshed 25-test deck visuals, and post-render ASR validation.
- [x] Prepare the DoraHacks BUIDL profile copy and a validated 480 x 480 project logo under 2 MB.
- [x] Upload the final demo video and verify its YouTube URL without authentication.
- [ ] Complete a final human playback review and add team identity before DoraHacks submission.

## Hackathon readiness hardening — 2026-08-26

- [x] Re-audit the official event requirements and the emerging public competitive field.
- [x] Put project-owned source, settlement, proof, accounting, and replay evidence above the interactive
      workflow so judges can verify the result before connecting a wallet.
- [x] Add a credential-free `pnpm judge:verify` path that combines public-chain evidence verification
      with the local vertical-slice integration test.
- [x] Harden public evidence reads against transient RPC failures with bounded retries, serialized
      historical queries, and a Creditcoin Blockscout RPC fallback.
- [x] Remove build-time Google Fonts access by bundling self-hosted font packages.
- [x] Add Open Graph/Twitter metadata, a generated 1200×630 social card, and an application icon.
- [x] Expand adversarial coverage for reused device nonces, tariff mismatch, nondeterministic session
      IDs, and incorrect metering math.
- [ ] Human-review and publicly host the final MP4, fill team identity/contact, and submit DoraHacks.

## Architecture decisions

Use one pnpm monorepo and one Hardhat toolchain across two contract packages. Pin Solidity `0.8.28`
because the current `@gluwa/usc-contracts@0.2.0` decoder uses that pragma. The proof worker uses the
official SDK (which currently retains the USC package name) behind a small domain-specific adapter.
The web app uses viem/wagmi; the worker uses ethers only where required by the SDK.
