# Competitive analysis

Research date: 2026-08-21.

The official DoraHacks page reported `buidlsCount: 0` when inspected, so there were no public Fall 2026
submissions to compare directly. This document will be refreshed once entries become public. The product
brief also identified recurring cross-chain concepts from prior/community ideation: lending and credit
scores, AI treasury councils, trade-finance delivery escrow, liquidation sentinels, and generic agent
payment verification.

ChargeProof is deliberately different:

| Dimension           | Crowded pattern                  | ChargeProof                                                                  |
| ------------------- | -------------------------------- | ---------------------------------------------------------------------------- |
| Physical network    | Financial event with a new label | Metered EV charger and authorized device receipt                             |
| Attestcoin role     | Auxiliary confirmation           | Mandatory settlement authorization path                                      |
| Cross-chain binding | Generic event signature          | Exact chain, target, sender, selector, calldata, receipt status, and intent  |
| Value flow          | Mint or generic payout           | Max-payment escrow, metered final payout, deterministic unused refund        |
| Security story      | Inclusion treated as execution   | Source success and every business invariant revalidated on Creditcoin        |
| Expansion           | One financial product            | Reusable settlement primitive for charging, microgrids, telecom, and sensors |

The MVP is intentionally narrow: one station, one tariff model, one virtual hardware device, Sepolia as the
source, and Creditcoin Testnet as execution chain. It does not claim physical-energy truth; the authorized
device signature is the explicit physical trust boundary.
