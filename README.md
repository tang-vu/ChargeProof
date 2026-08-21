# ChargeProof

> Trustless cross-chain EV charging settlement.

ChargeProof is a DePIN settlement protocol where an EV driver escrows demo USDC on Creditcoin
Testnet, a charger anchors a device-signed session on Ethereum Sepolia, and the operator is paid
only after Creditcoin's Attestcoin Protocol verifies that exact source transaction. The unused
escrow is credited back to the driver.

**Hackathon:** BUIDL CTC 2026 Fall — “BUIDL For The Real World”<br>
**Track:** DePIN<br>
**Status:** contracts, worker, dashboard, and local tests are complete; ChargeProof-owned testnet
deployments still require funded burner wallets. Official-protocol proof-spike evidence is clearly
separated from project deployment evidence.

**Submission deck:** [ChargeProof-Deck.pdf](submission/ChargeProof-Deck.pdf)

**Live demo:** [chargeproof-plum.vercel.app](https://chargeproof-plum.vercel.app) — explicitly runs in
`LOCAL SIMULATION` mode until project-owned testnet contracts are deployed.

## The real-world problem

EV roaming joins drivers, charge point operators, mobility providers, and payment rails that do not
share one ledger. A source-chain event alone cannot release funds on another chain: the destination
needs an authenticated, replay-safe fact about the source transaction, plus business validation of
what that transaction means.

ChargeProof narrows that problem to one auditable primitive: **pay a registered station only when a
successful, canonical, device-signed charging receipt matches a funded intent.** It is useful beyond
EV charging wherever metered infrastructure produces signed usage receipts.

## Why Attestcoin is essential

The escrow contract cannot read Sepolia. Attestcoin supplies the cryptographic inclusion and
continuity proof that lets Creditcoin verify the source transaction through its native Block Prover.
Without Attestcoin, a relayer could invent or alter the transaction bytes, and the settlement path
cannot run. ChargeProof does not treat inclusion as sufficient: it revalidates the receipt status,
sender, contract, selector, calldata, device signature, intent, price, expiry, and replay keys on
Creditcoin.

Attestcoin does **not** prove physical electricity delivery. In this MVP, an authorized burner device
key represents the charger hardware boundary. Secure elements, OCPP/OCPI integration, hardware
attestation, and independent meter corroboration are production roadmap items.

## Architecture

```mermaid
sequenceDiagram
    actor D as EV driver
    participant E as Creditcoin escrow
    participant V as Virtual charger
    participant S as Sepolia registry
    participant A as Attestcoin prover
    participant C as Creditcoin verifier
    actor O as Station operator

    D->>E: Open intent + escrow max MockUSDC
    V->>V: Meter energy and sign EIP-712 receipt
    D->>S: finalizeSession(receipt, deviceSignature)
    S-->>D: Successful Sepolia transaction
    D->>A: Resume by source transaction hash
    A-->>D: Inclusion + continuity proof after attestation
    D->>C: verifyAndSettle(proof)
    C->>C: Block Prover + source/business checks
    C->>E: Settle verified amount
    E-->>O: Claimable station payment
    E-->>D: Claimable unused escrow
```

| Layer      | Component                         | Responsibility                                                                 |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------ |
| Sepolia    | `ChargingSessionRegistry`         | Canonical selector, device EIP-712 validation, session/nonce replay prevention |
| Attestcoin | SDK + proof service + `0x…0FD2`   | Source transaction inclusion and chain continuity verification                 |
| Creditcoin | `AttestcoinChargeVerifier`        | Decode verified EVM transaction and revalidate every settlement invariant      |
| Creditcoin | `ChargeIntentEscrow`              | Hold max payment, record outcome, expose pull-based payment/refund claims      |
| Creditcoin | `StationRegistry`                 | Snapshot payout/device identity and maintain explainable settlement metrics    |
| Web/worker | Next.js dashboard + resumable CLI | Device simulation, wallet flow, persisted proof lifecycle, diagnostics         |

See [Architecture](docs/ARCHITECTURE.md) and the exact
[Attestcoin integration](docs/ATTESTCOIN_INTEGRATION.md).

## End-to-end flow

1. Connect to Creditcoin Testnet, mint demo `MockUSDC`, approve the escrow, and open an intent.
2. Run the explicitly labeled virtual charger. Energy, duration, tariff, and amount remain visible.
3. A server-held burner device key signs the deterministic receipt; the driver submits it to the
   canonical Sepolia registry.
4. Resume the attestation worker by source hash. It confirms mining, waits for both on-chain and
   prover heights, generates a proof with `@gluwa/usc-sdk`, and checks the live Block Prover.
5. Anyone can submit the proof. Creditcoin verifies and settles atomically, recording station credit,
   driver refund credit, metrics, and replay markers.
6. The operator and driver withdraw their own claims. A failed transfer cannot revert settlement.

## Live evidence and contracts

ChargeProof deployment metadata is machine-readable in
[`deployments/`](deployments). Empty addresses mean “not deployed,” never a simulated deployment.

| Evidence                                                       | Status                 | Link                                                                                                                                      |
| -------------------------------------------------------------- | ---------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Official Attestcoin example source transaction used for Gate 1 | Verified               | [Sepolia transaction](https://sepolia.etherscan.io/tx/0xce785c35e300d607d83da9564990c4d2aaf45dafc68ef76539d97aee3de6859b)                 |
| Gate 1 proof generated with SDK 0.18.0                         | Verified locally       | 8 Merkle siblings, 47 continuity roots; live `verifySingle = true`                                                                        |
| Official example destination transaction                       | Verified               | [Creditcoin transaction](https://creditcoin-testnet.blockscout.com/tx/0x7cc3a7333e9522f5921e6430bd59192caf7e1ce2382ae022879da93cd4ae9388) |
| ChargeProof Sepolia registry                                   | Awaiting funded burner | See `deployments/sepolia.json`                                                                                                            |
| ChargeProof Creditcoin contracts and custom settlement         | Awaiting funded burner | See `deployments/creditcoin-testnet.json`                                                                                                 |
| Hosted dashboard                                               | Local simulation       | [Vercel production deployment](https://chargeproof-plum.vercel.app)                                                                       |

The first three rows prove the current official protocol/tooling path, not a ChargeProof settlement.
Project-specific evidence will be added only after explorer-verifiable deployment. See
[submission/EVIDENCE.md](submission/EVIDENCE.md).

## Security model

- Source chain key, source registry, function selector, successful receipt status, and recovered
  source sender are checked from Attestcoin-verified transaction bytes.
- The same EIP-712 device signature and deterministic pricing/session formula are verified on both
  chains.
- Intent parameters snapshot the operator payout and device signer, avoiding mutable-registry races.
- Receipt start time must follow intent creation within a five-minute cross-chain clock tolerance.
- Three replay domains protect source transaction position, intent settlement, and session ID.
- Escrow uses `SafeERC20`, checks-effects-interactions, `ReentrancyGuard`, and pull payments.
- The verifier and station metrics recorder are one-time bindings; there is no proxy or upgrade path.
- Expired intents become refundable only after a 30-minute attestation grace period.

Read the complete [threat model](docs/THREAT_MODEL.md) before treating this MVP as production-ready.

## Local setup

Requirements: Node.js 24.x, pnpm 11, and Git. No private key is required for local tests.

```bash
pnpm install --frozen-lockfile
pnpm compile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm secret:scan
pnpm --filter @chargeproof/web dev
```

Copy `.env.example` to a local `.env.local` only when using testnets. Never commit it. See
[Local development](docs/LOCAL_DEVELOPMENT.md) for the local simulation and
[Testnet deployment](docs/TESTNET_DEPLOYMENT.md) for burner-wallet steps.

For a new dedicated testnet burner set, `pnpm wallets:create` writes only Git-ignored environment
files and prints public addresses only. `pnpm wallets:status` performs a read-only balance check.

## Environment configuration

Public defaults cover RPC, explorers, chain IDs, chain key `1`, proof service, and Block Prover
`0x0000000000000000000000000000000000000FD2`. Deployment addresses remain blank until deployed.
Private variables are deliberately server/CLI-only:

- `SEPOLIA_DEPLOYER_PRIVATE_KEY`
- `CREDITCOIN_DEPLOYER_PRIVATE_KEY`
- `DEVICE_SIMULATOR_PRIVATE_KEY`
- `CREDITCOIN_SETTLER_PRIVATE_KEY` (optional because proof submission is permissionless)

Use dedicated testnet-only wallets. Never paste a key into chat, frontend code, logs, or Git.

After the dedicated deployer has gas on both testnets, the recommended resumable project-owned flow
is `pnpm testnet:gate2`. It deploys both stacks idempotently, opens the intent, anchors the signed
receipt, waits for Attestcoin, settles, submits an expected-failing replay, and writes public results
to `deployments/gate2-evidence.json`. It never prints or persists either private key.

## Test and quality commands

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm compile
pnpm test
pnpm build
pnpm secret:scan
pnpm proof:resume -- 0xSOURCE_TRANSACTION
pnpm wallets:status
# Credentialed and state-changing on testnets only:
pnpm testnet:gate2
```

`docs/BUILD_STATUS.md` records commands actually run. Mocked unit tests replace only the native
precompile boundary; live protocol evidence is labeled separately.

## Known limitations

- The charger is a hardware simulator, not a connected physical EVSE.
- Device authorization is owner-managed and centralized for the MVP.
- Testnet deployment and custom explorer evidence require funded burner wallets.
- RPC and proof services are external availability dependencies; the worker persists progress and can
  resume, but cannot make a stalled attestation advance.
- `MockUSDC` has no monetary value and is not production collateral.

More detail: [Known limitations](docs/KNOWN_LIMITATIONS.md).

## Roadmap

The next production stages are secure-element device keys, OCPP 2.0.1/ISO 15118 receipt ingestion,
multi-operator onboarding, decentralized device attestation, stablecoin/payment-provider integration,
observability, audits, and a CEIP proposal covering reusable metered-infrastructure settlement. The
same receipt-proof-escrow primitive can serve solar microgrids, telecom hotspots, and other measured
DePIN services. See [CEIP roadmap](docs/CEIP_ROADMAP.md).

## Repository map

```text
apps/web                         One-page dashboard and device-signing boundary
services/attestation-worker      Idempotent proof lifecycle CLI/service
packages/contracts-sepolia       Canonical charging-session source contract
packages/contracts-creditcoin    Verifier, escrow, station registry, MockUSDC
packages/shared                  Chain constants, ABI, EIP-712 receipt helpers
deployments                      Machine-readable testnet metadata
docs                             Research, architecture, security, operations
submission                       Judge copy, deck, video, evidence, checklist
```

## License

MIT. See [LICENSE](LICENSE).
