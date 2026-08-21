# ADR-0001: prove canonical calldata and revalidate settlement on Creditcoin

Status: accepted on 2026-08-21.

## Decision

The Sepolia driver calls a non-upgradeable `ChargingSessionRegistry.finalizeSession` function with a typed
receipt and device signature. Creditcoin verifies the SDK-encoded transaction through Block Prover, then
decodes common transaction fields and receipt status. It requires the configured chain key, canonical
registry address, driver sender, exact selector, successful receipt, device EIP-712 signature, and escrow
business invariants before settlement.

Escrow snapshots the station payout and device signer when an intent opens. Settlement credits pull-based
claims for operator payment and driver refund, so a recipient transfer failure cannot block proof processing.

## Rationale

Attestcoin proves inclusion and continuity, not physical delivery and not EVM success. Canonical calldata
plus a successful receipt binds the proof to immutable source logic; target-side signature and invariant
checks minimize reliance on source logic. Pull payments preserve atomic accounting without making proof
settlement depend on receiver behavior.

## Consequences

- The verifier is larger than an event-only consumer but has an explicit trust boundary.
- The device-signature domain must use Sepolia chain ID and the deployed source registry on both chains.
- Existing intents remain safe if station metadata later changes.
- A live deployment requires a funded Sepolia burner and a funded Creditcoin Testnet burner.
