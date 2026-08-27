# Submission form

Copy-ready record for the BUIDL CTC 2026 Fall submission. Personal team and contact values supplied
directly to DoraHacks are intentionally not duplicated in this public repository.

## DoraHacks BUIDL Profile

### BUIDL (project) name

ChargeProof

### BUIDL logo

Upload `submission/assets/chargeproof-logo.png`. It is a 480 x 480 PNG derived from the dashboard's
existing cyan/lime energy mark and is kept below the 2 MB form limit.

### Vision

EV charging roaming depends on fragmented networks of drivers, charge point operators, mobility
providers, and payment systems that do not share one trusted settlement record. An operator should
not have to trust a centralized relayer's claim that a remote charging transaction occurred, while a
driver should not pay more than the metered session authorized in advance.

ChargeProof creates an evidence-bound settlement rail. A driver escrows a maximum payment on
Creditcoin Testnet, and an authorized charging device signs a deterministic receipt that the driver
anchors through a canonical contract on Ethereum Sepolia. Creditcoin releases the exact operator
payment and refunds unused escrow only after Attestcoin cryptographically verifies the source
transaction and ChargeProof revalidates its contract, selector, sender, receipt, device signature,
intent, tariff, amount, expiry, and replay state.

The hackathon MVP uses a clearly labeled virtual charger, but the settlement primitive is designed to
extend to physical EVSE hardware, solar microgrids, telecom, battery swapping, and other metered DePIN
infrastructure. Attestcoin is essential: removing it removes the authenticated bridge between the
Sepolia charging receipt and Creditcoin settlement.

### Category

Select `DePIN`. If the profile category list does not expose `DePIN`, select `Infrastructure` and keep
the hackathon track set to `DePIN`.

### Links

- GitHub/GitLab/Bitbucket: `https://github.com/tang-vu/ChargeProof`
- Project website: `https://chargeproof-plum.vercel.app`
- Demo video: `https://youtu.be/ezp9PUCCaRI`
- DoraHacks BUIDL: `https://dorahacks.io/buidl/48131`

### Social links

- `https://github.com/tang-vu`

The public GitHub profile was used as the required verified social link. Optional accounts were not
invented solely to fill additional rows.

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

The project-owned Gate 2 run settled a 4.20 kWh receipt: the operator received 1.47 valueless
MockUSDC, 3.53 was credited back to the driver, and a second mined submission of the identical proof
reverted. The source, settlement, replay, proof dimensions, contracts, and public-RPC verification are
linked in `submission/EVIDENCE.md`.

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

- GitHub Repository URL: `https://github.com/tang-vu/ChargeProof`
- Project Deck/PDF URL:
  `https://github.com/tang-vu/ChargeProof/blob/main/submission/ChargeProof-Deck.pdf`
- Demo Video URL: `https://youtu.be/ezp9PUCCaRI`
- DoraHacks BUIDL URL: `https://dorahacks.io/buidl/48131`
- Live Demo URL: `https://chargeproof-plum.vercel.app`
- Sepolia source contract:
  `https://sepolia.etherscan.io/address/0x1F4E029B8e1FD4291fB96F64C3f12529F1f756fc`
- Sepolia verified source:
  `https://sourcify.dev/server/repo-ui/11155111/0x1F4E029B8e1FD4291fB96F64C3f12529F1f756fc`
- Creditcoin escrow:
  `https://creditcoin-testnet.blockscout.com/address/0x39349C8539055C3E6fc637651d4Fe3373E3dB988`
- Creditcoin verifier:
  `https://creditcoin-testnet.blockscout.com/address/0xA205b6d1BD09ACB1b9575A98a942aCbcFF3CdEf3`
- Real custom source transaction:
  `https://sepolia.etherscan.io/tx/0x5c7eed57e460be3741746ab469527361fd3f50fe63cd28c07733de0dbfa50938`
- Real custom settlement transaction:
  `https://creditcoin-testnet.blockscout.com/tx/0xc7ad38e06f6462ab880ea638ae9205081435ed89a76581ad66067acb4436514b`
- Rejected replay evidence:
  `https://creditcoin-testnet.blockscout.com/tx/0xb9155eb1eaaf8bee27c1ce6fd55008442d17c006bfa65240f33513467161daff`

## Deployment Evidence

See `submission/EVIDENCE.md`. The project-owned Gate 2 rows were independently checked through public
RPCs with `pnpm evidence:verify`.

## Team

Required team identity and contact information was supplied directly in the DoraHacks form. It is not
republished here because it is personal submission data rather than technical project evidence.

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
