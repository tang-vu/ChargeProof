# Known limitations

## Current MVP

- **Simulated hardware:** the virtual charger generates realistic deterministic receipt data but is
  not connected to an EVSE or certified meter.
- **Device trust:** one owner-registered EOA signer represents a station device. There is no secure
  element, manufacturer certificate chain, rotation epoch, or decentralized attestation.
- **Testnets only:** Sepolia, Creditcoin Testnet, and valueless MockUSDC are unsuitable for production.
- **Central station onboarding:** an owner registers station payout/device metadata. Existing intents
  snapshot values, but onboarding itself is not decentralized.
- **Public infrastructure:** RPC and proof endpoints have no ChargeProof-controlled SLA.
- **Attestation latency:** the workflow is resumable but cannot guarantee an exact proof time.
- **Privacy:** calldata and device signature are public. A production receipt may need minimization or
  privacy-preserving commitments.
- **Token scope:** one conventional six-decimal demo ERC-20 is used. Fee-on-transfer, rebasing,
  callback-heavy, or sanctioned assets are not supported.
- **Legal/commercial scope:** the MVP does not implement tax invoices, disputes, chargebacks, roaming
  contracts, identity checks, or jurisdiction-specific consumer rules.
- **Single live sample:** one project-owned Gate 2 settlement and one rejected replay are public. More
  sessions, devices, adverse-network runs, and long-duration reliability data are still needed.

## Security boundary

A valid proof says that the verified source transaction/receipt data belongs to the attested Sepolia
chain according to Attestcoin. It does not independently prove electricity delivery. That physical
claim comes from the registered device signature and is only as strong as device custody and meter
integrity.

## Not claimed

ChargeProof does not claim mainnet readiness, a completed audit, guaranteed CEIP funding, guaranteed
investment, regulatory approval, a live physical charger, production token value, or a hosted SLA.
The CertiK hackathon benefit is audit credit, not cash.
