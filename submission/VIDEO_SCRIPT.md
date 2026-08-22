# Demo video script

Target duration: 2:50. Narration is exact English copy. Gate 2 evidence below is project-owned and
explorer-verifiable. The reproducible production source is `submission/video/scenes.json`; generated
media remains Git-ignored until a human reviews and uploads it.

## Automated production

```text
pnpm video:visuals  # public dashboard and deck frames
pnpm video:preview  # credential-free silent composition check
pnpm video:audio    # MiMo V2.5 TTS followed by MiMo V2.5 ASR validation
pnpm video:render   # final H.264/AAC MP4 with English subtitles
```

Never use a credential pasted into chat. Revoke it, configure its replacement only as a local
`MIMO_API_KEY`, and review `submission/video/README.md` before generation.

## 0:00–0:15 — Problem and pitch

**Screen:** ChargeProof hero and two-network route.

**Narration:** “EV charging crosses drivers, devices, operators, and payment systems that do not share
one ledger. ChargeProof is a trustless settlement rail: the operator gets paid only when a
cryptographically verified cross-chain charging receipt matches the driver's escrowed intent.”

**Click:** Scroll just enough to reveal the seven-step workflow.

## 0:15–0:35 — Architecture

**Screen:** Architecture route or deck slide 5.

**Narration:** “The driver escrows demo USDC on Creditcoin. A charger signs its metered receipt and the
driver anchors it on Sepolia. Attestcoin proves that exact successful transaction to Creditcoin. Our
verifier then checks the source, sender, receipt, device, price, and replay state before settlement.
Without Attestcoin, Creditcoin has no authenticated source input and this path cannot run.”

## 0:35–0:55 — Open intent

**Screen:** Live-testnet badge, connected wallet, station card.

**Narration:** “I select this registered station, mint valueless test MockUSDC, and escrow a maximum
payment with an agreed tariff and expiry. The station payout and device signer are snapshotted now, so
later registry changes cannot redirect this intent.”

**Click:** Faucet if needed → approve → open intent → open Creditcoin explorer link.

**Expected:** Intent state `Open`, transaction `0xb9e39a…f871` successful.

## 0:55–1:15 — Simulate charging

**Screen:** Virtual charger card.

**Narration:** “This is explicitly a hardware simulator for the hackathon MVP. It meters integer
watt-hours, calculates the final amount without floating point, and asks an isolated burner device key
to sign every receipt field using EIP-712. No persistent private key reaches the browser.”

**Click:** Start, let energy rise, then stop/finalize; expand decoded receipt.

**Expected:** Deterministic session ID, valid signature, amount below max escrow.

## 1:15–1:35 — Anchor on Sepolia

**Screen:** Wallet confirmation, then source timeline.

**Narration:** “The driver submits the signed receipt to one canonical Sepolia function. The source
contract rechecks the device, amount, timing, session ID, and nonce. Here is the real mined transaction
and its source block.”

**Click:** Confirm → wait for mined → open Sepolia explorer.

**Expected:** `0x5c7eed…0938`, status success, canonical registry target.

## 1:35–1:50 — Generate proof

**Screen:** Attestcoin timeline and proof metadata.

**Narration:** “ChargeProof persists this hash and waits until both on-chain and prover attestation
heights pass the source block. The official SDK returns the encoded transaction, Merkle path, and
continuity proof. The worker verifies it against Creditcoin's live Block Prover before enabling
settlement.”

**Click:** Refresh/resume.

**Expected:** `Proof ready`, chain key `1`, 7 siblings, 7 continuity roots.

**Slow path:** “Attestation is asynchronous, so I can safely resume by hash. I will switch to a
previous real ChargeProof receipt prepared for this demo.” Load
`0x5c7eed57e460be3741746ab469527361fd3f50fe63cd28c07733de0dbfa50938` and continue.

## 1:50–2:20 — Settle and show replay failure

**Screen:** Creditcoin confirmation, breakdown, station metrics, explorers.

**Narration:** “Anyone can submit the public proof. On Creditcoin, the native precompile authenticates
the source bytes; our contract then repeats all business checks. The exact charge is credited to the
operator, unused escrow to the driver, and station metrics update atomically. Transfers are pull-based,
so a failed recipient cannot block settlement. Reusing the same proof now fails under independent
source, intent, and session replay keys.”

**Click:** Settle → explorer → replay action or failed replay evidence.

**Expected:** `0xc7ad38…514b` success; operator 1.47 MockUSDC; refund 3.53 MockUSDC;
`0xb9155e…daff` reverts.

## 2:20–2:40 — Attestcoin indispensability

**Screen:** Proof details next to verifier checks.

**Narration:** “Attestcoin is not decoration here. Remove it, and a relayer can invent source calldata;
the settlement function has no trusted input. But we also do not overclaim: Attestcoin proves the
source transaction, not physical electricity. The authorized device signature represents that physical
boundary in this MVP.”

## 2:40–3:00 — Impact and roadmap

**Screen:** Metrics and roadmap strip.

**Narration:** “ChargeProof turns metered service into authenticated, bounded payment. Next we connect
secure-element charger keys and OCPP or OCPI, then generalize the audited primitive to solar,
telecom, and other DePIN networks. ChargeProof: trustless cross-chain EV charging settlement.”

## Recording checklist

- Use real live-testnet mode; never record local simulation as testnet.
- Keep private environment files and wallet key views off screen.
- Record source/target explorer tabs at readable zoom.
- If using historical backup evidence, say “previous real settlement” on camera.
- Do not claim a deck upload, video upload, source verification, or hosted URL until it exists.
