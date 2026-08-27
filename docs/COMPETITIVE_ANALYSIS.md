# Competitive analysis

Research dates: 2026-08-21 and 2026-08-26.

The official DoraHacks page reported `buidlsCount: 0` on the first inspection. That observation is now
treated only as a dated snapshot, not as a current claim about the field. A 2026-08-26 public repository
search found at least one emerging Fall 2026 project: [AttestDesk](https://github.com/Qidianyan/attestdesk),
an AI/RWA invoice-underwriting flow with a credential-free fixture demo. The broader product scan also
identified recurring cross-chain concepts: lending and credit scores, AI treasury councils, trade-finance
delivery escrow, liquidation sentinels, and generic agent payment verification.

ChargeProof is deliberately different:

| Dimension           | Crowded pattern                  | ChargeProof                                                                  |
| ------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Physical network    | Financial event with a new label | Metered EV charger and authorized device receipt                             |
| Attestcoin role     | Auxiliary confirmation           | Mandatory settlement authorization path                                      |
| Cross-chain binding | Generic event signature          | Exact chain, target, sender, selector, calldata, receipt status, and intent  |
| Value flow          | Mint or generic payout           | Max-payment escrow, metered final payout, deterministic unused refund        |
| Security story      | Inclusion treated as execution   | Source success and every business invariant revalidated on Creditcoin        |
| Expansion           | One financial product            | Reusable settlement primitive for charging, microgrids, telecom, and sensors |

## Current competitive read

AttestDesk raises the quality bar for judge onboarding: it publishes a short no-key command path, a checked-in
fixture, and a demo video. ChargeProof now answers that strength with `pnpm judge:verify`, but differentiates on
the evidence boundary rather than copying the product shape. The command re-reads five real deployed contracts,
the successful source and settlement receipts, the mined replay revert, settled intent accounting, and station
metrics before it runs the explicitly local integration path. ChargeProof's strongest comparative advantage is
therefore its complete project-owned live vertical slice and DePIN-specific physical-device trust model.

The material competitive risk was presentation rather than implementation depth. That risk is now reduced: the
final video is hosted, the DoraHacks BUIDL has been submitted, and the dashboard's evidence-first strip, social
preview, and no-key verifier give judges a short path into the deeper implementation. A final human playback
sign-off remains an operational follow-up rather than a submission blocker.

The MVP is intentionally narrow: one station, one tariff model, one virtual hardware device, Sepolia as the
source, and Creditcoin Testnet as execution chain. It does not claim physical-energy truth; the authorized
device signature is the explicit physical trust boundary.
