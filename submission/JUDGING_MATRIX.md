# Judging matrix

## Judge fast path

1. Open the [live dashboard](https://chargeproof-plum.vercel.app) and use the project-owned evidence
   strip to inspect source, settlement, and mined replay-revert transactions without connecting a
   wallet.
2. Run `pnpm judge:verify` with no credentials. It re-reads the deployed runtime code, receipts,
   settled intent, station accounting, and replay marker from public RPCs, then executes the local
   vertical slice.
3. Read `docs/THREAT_MODEL.md` for the exact boundary between Attestcoin, ChargeProof business rules,
   and simulated hardware.

## Scorecard and remaining deductions

| Area                 | Evidence that earns points                                                                                  | Honest deduction / mitigation                                                                                           |
| -------------------- | ----------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Attestcoin necessity | Settlement cannot execute without native proof verification; real custom proof accepted                     | Attestcoin proves chain inclusion, not electricity; device signature is labeled as the MVP physical boundary            |
| Functional depth     | Funded intent, source receipt, proof, settlement, refund accounting, metrics, and replay rejection are live | A fresh interactive run needs two testnet wallets and attestation wait time; historical evidence is visible immediately |
| DePIN fit            | Metered EV infrastructure drives cross-chain payment and incentives                                         | Charger is a simulator; secure-element and OCPP/OCPI pilot remain roadmap work                                          |
| Security             | Dual-chain validation, three replay domains, pull claims, immutable bindings, adversarial tests             | No independent audit; production use is explicitly blocked pending one                                                  |
| Reproducibility      | Public source verification, clean CI, one-command credential-free judge verification                        | Public RPCs can be transient; verifier now retries and uses an explorer-backed fallback while failing closed            |
| Product polish       | Responsive live dashboard, evidence-first UX, deck, hosted narrated demo, social preview                    | Team identity still requires human account access before submission                                                     |
| Ecosystem value      | Reusable authenticated metered-receipt primitive and concrete CEIP roadmap                                  | No physical pilot or signed operator LOI is claimed                                                                     |

## Hackathon requirements

| Requirement                       | ChargeProof response                                                                                            | Evidence                                                    | Status                                         |
| --------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ---------------------------------------------- |
| Meaningful Attestcoin integration | Attestcoin is the only authenticated Sepolia-to-Creditcoin input; removing it makes settlement impossible       | `AttestcoinChargeVerifier.sol`, `ATTESTCOIN_INTEGRATION.md` | Custom Gate 2 proof settled live               |
| Functional integration            | Official SDK proof generation, live precompile readiness check, target `verifyAndEmit`, resumable Gate 2 runner | worker and project-owned explorer evidence                  | Custom settlement and rejected replay verified |
| Creditcoin Testnet deployment     | Four destination contracts and deploy script                                                                    | `deployments/creditcoin-testnet.json`                       | Deployed; Blockscout source verified           |
| Source testnet deployment         | Canonical Sepolia registry and deploy script                                                                    | `deployments/sepolia.json`                                  | Deployed; Sourcify source verified             |
| Original hackathon work           | Custom EV receipt, escrow, device simulator, UX, security model                                                 | repository history and research attribution                 | Complete to date                               |
| Public repository                 | Clean monorepo and MIT license                                                                                  | `https://github.com/tang-vu/ChargeProof`                    | Public; clean-runner CI passed                 |
| README                            | Problem, architecture, integration, evidence, security, setup, limitations, roadmap                             | `README.md`                                                 | Complete with Gate 2 explorer evidence         |
| Project deck/PDF URL              | Ten-slide source and rendered 16:9 PDF                                                                          | `submission/ChargeProof-Deck.pdf`                           | Public through GitHub                          |
| Hosted dashboard                  | Responsive evidence-first demo with truthful mode badge and historical proof                                    | `https://chargeproof-plum.vercel.app`                       | Public live-testnet deployment                 |
| Demo video URL                    | 2:55 MiMo-narrated, post-render ASR-validated walkthrough                                                       | `https://youtu.be/ezp9PUCCaRI`                              | Hosted; anonymous access verified              |

## Product and track fit

| Judge question                     | Answer                                                                                                        | Repository evidence                               |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| Is this DePIN?                     | Yes. It settles payment for metered physical charging infrastructure, with an explicit device trust boundary. | dashboard simulator, receipt schema, threat model |
| What real-world pain is addressed? | Fragmented EV roaming evidence and operator payment reconciliation.                                           | README problem/solution                           |
| Why blockchain?                    | Bounded escrow, auditable settlement, permissionless proof submission, deterministic refunds/metrics.         | escrow/verifier contracts                         |
| Why cross-chain?                   | The charging receipt is anchored on Sepolia while payment escrow lives on Creditcoin.                         | architecture and network bindings                 |
| Why Attestcoin?                    | It authenticates the exact source transaction without a privileged relayer.                                   | native proof call and decoder                     |
| Can it expand?                     | Same authenticated metered-receipt primitive can serve microgrids, telecom, and battery systems.              | CEIP roadmap                                      |

## Technical depth

| Criterion            | Implementation                                                                            |
| -------------------- | ----------------------------------------------------------------------------------------- |
| Exact source binding | immutable chain key/registry, selector, receipt status, source sender                     |
| Business validation  | device EIP-712, deterministic session/amount, intent, station, tariff, expiry, maximum    |
| Replay defense       | source position, settlement key, session ID, source nonce, terminal intent state          |
| Accounting           | maximum escrow becomes operator credit plus driver refund; pull withdrawals               |
| Resumability         | atomic per-hash state, on-chain/prover height diagnostics, retry/reload                   |
| Failure UX           | live/local labels, no fabricated hashes, diagnostics, explorer links only for real values |
| Quality              | strict TS, Solidity 0.8.28, unit tests, build/lint/typecheck/secret scan, CI              |

## Differentiation

Public competition inspection showed no listed submissions at research time. ChargeProof deliberately
avoids crowded generic lending/credit, AI treasury, trade-finance escrow, liquidation automation, and
agent-payment concepts. Its original wedge is EV/DePIN usage settlement with a dual proof boundary:
Attestcoin authenticates chain data while the device signature represents physical measurement.

## Prize/benefit accuracy

- The advertised CertiK amount is audit credit, not cash.
- A top-three project's CEIP fast-track is an opportunity for due diligence, not guaranteed investment.
- No award, placement, audit, deployment, or partnership is claimed before it occurs.
