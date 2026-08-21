# Judging matrix

## Hackathon requirements

| Requirement                       | ChargeProof response                                                                                      | Evidence                                                    | Status                                           |
| --------------------------------- | --------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------- | ------------------------------------------------ |
| Meaningful Attestcoin integration | Attestcoin is the only authenticated Sepolia-to-Creditcoin input; removing it makes settlement impossible | `AttestcoinChargeVerifier.sol`, `ATTESTCOIN_INTEGRATION.md` | Implemented locally; Gate 1 live verified        |
| Functional integration            | Official SDK proof generation, live precompile readiness check, target `verifyAndEmit`                    | worker source, Gate 1 evidence                              | Official flow verified; custom tx pending funds  |
| Creditcoin Testnet deployment     | Four destination contracts and deploy script                                                              | `deployments/creditcoin-testnet.json`                       | Pending funded burner                            |
| Source testnet deployment         | Canonical Sepolia registry and deploy script                                                              | `deployments/sepolia.json`                                  | Pending funded burner                            |
| Original hackathon work           | Custom EV receipt, escrow, device simulator, UX, security model                                           | repository history and research attribution                 | Complete to date                                 |
| Public repository                 | Clean monorepo and MIT license                                                                            | `https://github.com/tang-vu/ChargeProof`                    | Public; clean-runner CI passed                   |
| README                            | Problem, architecture, integration, evidence, security, setup, limitations, roadmap                       | `README.md`                                                 | Complete; Gate 2 explorer URLs pending           |
| Project deck/PDF URL              | Ten-slide source and rendered 16:9 PDF                                                                    | `submission/ChargeProof-Deck.pdf`                           | Public through GitHub                            |
| Hosted dashboard                  | Responsive evidence-first demo with truthful mode badge                                                   | `https://chargeproof-plum.vercel.app`                       | Public Local simulation; live mode awaits Gate 2 |
| Demo video URL                    | Exact 2:50 script and recovery path ready                                                                 | `submission/VIDEO_SCRIPT.md`                                | Recording/upload human action pending            |

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
