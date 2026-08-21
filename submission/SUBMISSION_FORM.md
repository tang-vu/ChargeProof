# Submission form

Copy-ready text for BUIDL CTC 2026 Fall. Replace bracketed placeholders only with verified public
values before submission.

## Project Name

ChargeProof

## Project Sector

DePIN

## Short Description

ChargeProof is a trustless cross-chain settlement rail for EV charging: a driver escrows payment on
Creditcoin, a charger anchors a device-signed receipt on Sepolia, and the operator is paid only after
Attestcoin cryptographically verifies the exact source transaction.

## Full Project Description

EV roaming settlement spans drivers, charge point operators, mobility platforms, and payment systems
that do not share one source of truth. A relayer saying that charging happened is not enough, and a
source-chain transaction cannot directly release funds on another chain.

ChargeProof turns one charging session into an evidence-bound payment. The driver opens a Creditcoin
Testnet intent and escrows the maximum charge in demo MockUSDC. A clearly labeled virtual charger
meters energy and creates an EIP-712 receipt signed by an authorized burner device key. The driver
anchors that receipt through the canonical `ChargingSessionRegistry` on Ethereum Sepolia.

After Sepolia's block is attested, a resumable worker uses the official Attestcoin SDK and proof service
to generate inclusion and continuity proof material. Creditcoin's native Block Prover verifies the
proof. The ChargeProof verifier then decodes the authenticated EVM transaction and independently
checks successful execution, source chain, canonical contract, function selector, sender, receipt,
intent, device signature, station, tariff, amount, expiry, and replay state. Only then does escrow
credit the exact operator payment and return unused capacity to the driver.

Attestcoin is indispensable: without it, Creditcoin has no authenticated source transaction and the
settlement function cannot run. At the same time, the project is honest about the physical boundary.
Attestcoin proves source-chain data, not electricity itself; the MVP's physical claim comes from an
authorized device signature. Secure-element hardware, OCPP/OCPI integration, certified meters, and
decentralized device identity form the production roadmap.

The result is a reusable DePIN settlement primitive for EV roaming, solar microgrids, telecom, battery
swapping, and other metered infrastructure—while deliberately shipping one complete EV vertical slice
instead of broad, unfinished features.

## Attestcoin Protocol Integration Summary

ChargeProof uses `@gluwa/usc-sdk@0.18.0` with Sepolia chain key `1`. The worker queries Creditcoin's
Chain Info precompile and proof-service attested height, persists progress by source transaction hash,
and calls `ProofBuilder.getProof`. It validates the returned proof against the live Block Prover before
submission. On Creditcoin, `AttestcoinChargeVerifier` calls the current official
`INativeQueryVerifier.verifyAndEmit` interface at `0x0000000000000000000000000000000000000FD2`,
decodes EVM V1 transaction and receipt fields with the official helper, and revalidates the complete
business receipt before releasing escrow. Removing Attestcoin removes the only authenticated bridge
between the Sepolia receipt and Creditcoin settlement.

## Links

- GitHub Repository URL: `[REPOSITORY_URL]`
- Project Deck/PDF URL: `[DECK_PDF_URL]`
- Demo Video URL: `[DEMO_VIDEO_URL]`
- Live Demo URL: `[LIVE_DEMO_URL]`
- Sepolia source contract: `[SEPOLIA_REGISTRY_EXPLORER_URL]`
- Creditcoin escrow: `[CREDITCOIN_ESCROW_EXPLORER_URL]`
- Creditcoin verifier: `[CREDITCOIN_VERIFIER_EXPLORER_URL]`
- Real custom source transaction: `[CHARGEPROOF_SEPOLIA_TX_URL]`
- Real custom settlement transaction: `[CHARGEPROOF_CREDITCOIN_TX_URL]`
- Rejected replay evidence: `[CHARGEPROOF_REPLAY_TX_OR_TRACE_URL]`

## Deployment Evidence

See `submission/EVIDENCE.md`. Do not replace placeholders until each explorer page is public and the
expected result has been independently checked.

## Team

- Name: `[TEAM_MEMBER_NAME]`
- Role: `[TEAM_ROLE]`
- Short bio: `[TWO_SENTENCE_RELEVANT_BIO]`
- Contact: `[CONTACT_HANDLE]`

Repeat the block for additional team members.

## Known Limitations

The MVP uses a virtual charger and authorized burner device key rather than physical EVSE hardware. It
runs only on Sepolia and Creditcoin Testnet with valueless MockUSDC. Station onboarding is centralized,
and public RPC/proof services provide no project-controlled SLA. Attestation progress is persisted and
resumable, but no exact wait time is promised. A physical pilot requires secure-element keys,
OCPP/OCPI or ISO 15118 integration, certified meter controls, operational monitoring, and an
independent audit.

## Hackathon Attribution

Built as original work for BUIDL CTC 2026 Fall — “BUIDL For The Real World,” DePIN track. Third-party
Attestcoin example code is used only as attributed interface/proof-flow scaffolding; ChargeProof's
contracts, receipt model, escrow logic, UX, tests, documentation, and submission are original.
