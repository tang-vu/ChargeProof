# Troubleshooting

## The dashboard says “Local simulation”

This is intentional when deployment variables are absent or incomplete. Check the public address
variables listed in `.env.example`, restart Next.js after changing them, and confirm the JSON files say
`deployed`. Never insert placeholder addresses just to enable live mode.

## Device signing returns HTTP 503

`DEVICE_SIMULATOR_PRIVATE_KEY` is absent. Put a dedicated, unfunded device burner's key in the
server-only ignored environment. Its derived address must match the station device signer on Sepolia
and the signer snapshotted by the Creditcoin intent. Do not use a `NEXT_PUBLIC_` variable.

## Device signing returns HTTP 400

The endpoint rejected inconsistent receipt data. Check deterministic `sessionId`, integer Wh, tariff,
ceiling-rounded amount, station ID, driver, and time ordering. This is a security failure, not a field
to bypass.

## Source transaction is mined but proof stays waiting

The worker waits for both the on-chain and proof-service attested heights to be above the source block.
Compare `blockNumber`, `latestOnchainAttestedHeight`, and `latestProverAttestedHeight` in diagnostics.
Retry later with the same hash. Do not create another source session.

## Proof generation fails

- Confirm Sepolia receipt status is `1`.
- Confirm the source `to` address equals the deployed canonical registry.
- Confirm calldata decodes to `finalizeSession`.
- Check the official proof service health and both RPCs.
- Preserve the worker JSON; a retriable failure does not invalidate the source transaction.

## `verifySingle` is false

Do not submit the proof. Reinspect source hash, chain key, attested height, and returned proof. Delete no
state until the underlying cause is understood. A stale or malformed proof should never be marked ready.

## Target gas estimation fails

Creditcoin's EVM/precompile boundary can make estimation unreliable. The worker first estimates with
35% headroom and otherwise uses a proof-size-based conservative fallback. A fallback does not bypass
verification. Ensure the submitting burner has enough testnet CTC.

## Settlement reverts

Decode the custom error and inspect, in order: chain key, source position replay, native proof, receipt
status, source registry, selector, source sender, intent state, station/driver/tariff, expiry, session
ID, amount, maximum escrow, and device signature. The worker's proof-ready state proves cryptographic
readiness, not that a mismatched business receipt is payable.

## Refund is too early

Refund is available only after intent expiry plus 30 minutes. This grace period gives an already-ended
session time to become attested. After refund, settlement is permanently rejected.

## A claimant cannot withdraw

Settlement already recorded independent claim credits. Fix the recipient/token compatibility and call
`withdrawClaim` again, possibly with a different nonzero recipient controlled by the claimant. Other
claimants remain unaffected.

## Hardhat generated-type errors

Run `pnpm compile` before package type checking. The repository typecheck scripts compile contract
packages first for this reason. Generated `artifacts`, `cache`, and `types` directories are ignored.

## A recurring issue appears

After the second occurrence, add the exact symptom, diagnostic, and recovery here and update
`AGENTS.md` if it changes contributor behavior.
