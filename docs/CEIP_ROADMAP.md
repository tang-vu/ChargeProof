# CEIP roadmap

## Candidate thesis

ChargeProof can become a Creditcoin ecosystem primitive for paying metered infrastructure from facts
anchored on supported external chains. EV charging is the first vertical because it makes every trust
boundary visible: intent, meter/device authorization, cross-chain proof, capped settlement, and refund.

## Stage 1 — hackathon vertical slice

- Sepolia device-signed charging receipt
- Attestcoin inclusion/continuity proof
- Creditcoin Testnet escrow settlement
- resumable proof worker and evidence-first dashboard
- replay, mismatch, expiry, and accounting tests

Exit criterion: one explorer-verifiable custom settlement and one rejected replay.

## Stage 2 — pilot hardening

- integrate an OCPP 2.0.1 charger simulator and one controlled physical EVSE
- secure-element or HSM device keys with rotation/revocation epochs
- add operator onboarding controls and multisignature administration
- benchmark attestation latency/proof gas and tune refund grace from measured tails
- independent smart-contract audit and public incident runbook

Exit criterion: repeatable multi-station testnet pilot with measured reliability and no shared device
keys.

## Stage 3 — roaming interoperability

- map OCPI/ISO 15118 identifiers and tariffs into a versioned receipt schema
- support privacy-minimized receipts and invoice references
- add a carefully reviewed stable asset and treasury/off-ramp integrations
- publish an operator SDK and conformance fixtures
- introduce explicit dispute evidence outside the automatic cryptographic happy path

Exit criterion: a limited commercial sandbox with real operators and documented legal/accounting scope.

## Stage 4 — reusable DePIN settlement rail

Generalize only the validated core into a versioned metered-service interface for solar microgrids,
telecom hotspots, battery swapping, water, and other measured infrastructure. Each vertical supplies
its own device-attestation and business-validation module; Attestcoin remains the authenticated
cross-chain fact layer.

## Proposed CEIP work packages

1. Production threat model, specification, audit, and formal accounting/replay invariants.
2. Open receipt schema and reference OCPP/OCPI adapter.
3. Device identity/rotation registry and secure-element reference integration.
4. Attestation observability, liveness metrics, and operator tooling.
5. Multi-vertical extension interface with two non-EV reference implementations.

Any CEIP submission should include milestones, measurable acceptance tests, maintenance ownership, and
cost estimates. Hackathon placement provides at most a fast-track opportunity for due diligence; it is
not guaranteed investment.
