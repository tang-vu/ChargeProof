# Demo runbook

## Objective

Demonstrate one real ChargeProof settlement in under three minutes while preserving a reliable backup
path for normal attestation latency.

## Before recording

- Run `pnpm check` and record its result in `docs/BUILD_STATUS.md`.
- Confirm deployment JSON, public web environment, device signer address, and both burner balances.
- Prepare one new open intent and one previously completed real settlement.
- Keep Sepolia and Creditcoin explorer tabs open to the relevant contract/transaction pages.
- Verify the proof worker can resume the prepared source hash.
- Prefer preparing the complete evidence set with `pnpm testnet:gate2`; it requires no browser import
  of the local deployer key and resumes from persisted hashes.
- Disable browser extensions and notifications unrelated to the demo.
- Never show a terminal containing environment values.

## Primary click sequence

1. Open the dashboard and point out **Live testnet**, both network badges, and the connected address.
2. Choose `CP-HCMC-001`, mint demo MockUSDC, approve, and open the intent.
3. Show the Creditcoin explorer link and intent's maximum payment/tariff/expiry.
4. Start the virtual charger; show increasing Wh, duration, and deterministic charge.
5. Stop/finalize; briefly open the decoded receipt and device-signature status.
6. Confirm the Sepolia wallet transaction; show pending, mined block, then explorer link.
7. Open the proof lifecycle. If the source is already attested, refresh to generate proof; otherwise
   explain the persisted waiting state and switch to the prepared historical source hash.
8. Show chain key, source block, latest attested heights, Merkle sibling count, and continuity-root
   count. Do not expose the complete byte payload on video.
9. Submit settlement on Creditcoin; show final amount, operator credit, driver refund, station metrics,
   and explorer link.
10. Submit the same proof in the prepared replay demonstration and show the expected revert.

## Expected UI states

```text
Intent:       Draft -> Wallet confirmation -> Open
Device:       Ready -> Charging -> Receipt signed
Sepolia:      Wallet confirmation -> Pending -> Mined
Attestcoin:   Waiting for attestation -> Proof ready
Creditcoin:   Wallet confirmation -> Settled
```

## Slow-network backup

Attestation can take several minutes and no exact ETA is promised. If it has not advanced during the
recording:

1. copy the diagnostic source hash and heights;
2. state that progress is persisted and resumable;
3. switch to the seeded **Previous real settlement** entry;
4. open its real source and target explorer transactions;
5. load its stored proof metadata and continue the settlement/replay explanation.

This is not a mock fallback. The historical entry must be populated only with a previously completed
ChargeProof testnet flow. If that evidence does not exist, pause recording rather than fabricating it.

## Recovery table

| Symptom                       | Recovery                                                                  |
| ----------------------------- | ------------------------------------------------------------------------- |
| Wallet on wrong chain         | Use the dashboard network action, then reread chain badge before signing  |
| Source transaction pending    | Open explorer; wait or replace same nonce in wallet                       |
| RPC error                     | Copy diagnostics, retry the idempotent step, preserve source hash         |
| Proof service error           | Retry later from stored state; no source resubmission needed              |
| Browser reload                | Paste/select saved source hash; local storage and worker state resume     |
| Target transaction pending    | Open stored target hash; never create a second source receipt             |
| Replay UI cannot estimate gas | Show expected custom-error simulation or a pre-recorded failed testnet tx |

## Evidence capture

Capture the address, network, purpose, transaction hash, block, status, explorer URL, decoded critical
fields, and expected/actual result. Add them to machine-readable deployment JSON and
`submission/EVIDENCE.md`. Do not include private RPC credentials, wallet seed material, or local paths.
