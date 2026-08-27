# Demo video script

Target duration: 2:55. Narration is exact English copy. Gate 2 evidence below is project-owned and
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

**Narration:** “Electric vehicle charging crosses drivers, devices, operators, and payment systems that do not share
one ledger. ChargeProof is a trustless settlement rail: the operator gets paid only when a
cryptographically verified cross-chain charging receipt matches the driver's escrowed intent.”

**Click:** Scroll just enough to reveal the seven-step workflow.

## 0:15–0:36 — Architecture

**Screen:** Architecture route or deck slide 5.

**Narration:** “Creditcoin holds the driver's demo USDC escrow. The charger signs a metered receipt,
and the driver anchors it on Sepolia. Attestcoin then proves that exact successful transaction to
Creditcoin. Our verifier checks sender, receipt, device, price, and replay state. Without Attestcoin,
settlement has no authenticated source input.”

## 0:36–0:55 — Open intent

**Screen:** Live-testnet badge, connected wallet, station card.

**Narration:** “The driver selects a registered station, mints valueless test MockUSDC, and escrows a
maximum payment with an agreed tariff and expiry. The station payout and authorized device signer are
snapshotted when the intent opens, so later registry changes cannot redirect payment.”

**Click:** Faucet if needed → approve → open intent → open Creditcoin explorer link.

**Expected:** Intent state `Open`, transaction `0xb9e39a…f871` successful.

## 0:55–1:15 — Simulate charging

**Screen:** Virtual charger card.

**Narration:** “This is explicitly a hardware simulator for the hackathon MVP. It meters integer
watt-hours, calculates the final amount without floating point, and uses an isolated burner device key
to sign every receipt field as typed data. No persistent device private key reaches the browser.”

**Click:** Start, let energy rise, then stop/finalize; expand decoded receipt.

**Expected:** Deterministic session ID, valid signature, amount below max escrow.

## 1:15–1:33 — Anchor on Sepolia

**Screen:** Wallet confirmation, then source timeline.

**Narration:** “The driver submits the signed receipt to one canonical Sepolia function. The source
contract rechecks the device, amount, timing, deterministic session identifier, and nonce. This
project-owned transaction was mined successfully in Sepolia block 11,539,874.”

**Click:** Confirm → wait for mined → open Sepolia explorer.

**Expected:** `0x5c7eed…0938`, status success, canonical registry target.

## 1:33–1:52 — Generate proof

**Screen:** Attestcoin timeline and proof metadata.

**Narration:** “ChargeProof persists the source hash and waits until both on-chain and prover
attestation heights pass its block. The official SDK returns the encoded transaction, Merkle path, and
continuity proof. Our worker verifies the result against Creditcoin's live Block Prover before
settlement is enabled.”

**Click:** Refresh/resume.

**Expected:** `Proof ready`, chain key `1`, 7 siblings, 7 continuity roots.

**Slow path:** “Attestation is asynchronous, so I can safely resume by hash. I will switch to a
previous real ChargeProof receipt prepared for this demo.” Load
`0x5c7eed57e460be3741746ab469527361fd3f50fe63cd28c07733de0dbfa50938` and continue.

## 1:52–2:17 — Settle and show replay failure

**Screen:** Creditcoin confirmation, breakdown, station metrics, explorers.

**Narration:** “On the target chain, the native precompile authenticates source bytes. Our contract
then repeats every business check. The operator receives 1.47 MockUSDC. The driver gets a 3.53 refund.
Metrics update atomically through withdrawable credits. Reusing the proof fails across source, intent,
and session replay keys. The rejected replay is also a mined public transaction.”

**Click:** Settle → explorer → replay action or failed replay evidence.

**Expected:** `0xc7ad38…514b` success; operator 1.47 MockUSDC; refund 3.53 MockUSDC;
`0xb9155e…daff` reverts.

## 2:17–2:36 — Attestcoin indispensability

**Screen:** Proof details next to verifier checks.

**Narration:** “Attestcoin is essential. Without it, a relayer could invent source calldata, and
settlement would lose its trusted cross-chain input. But Attestcoin proves a source transaction, not
physical electricity. For this MVP, an authorized device signature represents that physical boundary;
secure hardware remains roadmap work.”

## 2:36–2:55 — Impact and roadmap

**Screen:** Metrics and roadmap strip.

**Narration:** “ChargeProof turns metered service into authenticated, bounded payment. Next,
secure-element charger keys and OCPP or OCPI connect the protocol to real roaming infrastructure. This
settlement pattern can then extend to solar, telecom, and other DePIN services. ChargeProof: trustless
cross-chain electric vehicle charging settlement.”

## Recording checklist

- Use real live-testnet mode; never record local simulation as testnet.
- Keep private environment files and wallet key views off screen.
- Record source/target explorer tabs at readable zoom.
- If using historical backup evidence, say “previous real settlement” on camera.
- Do not claim a deck upload, video upload, source verification, or hosted URL until it exists.
