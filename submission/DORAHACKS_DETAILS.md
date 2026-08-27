# ChargeProof

> Trustless cross-chain EV charging settlement.

ChargeProof is a DePIN settlement protocol where an EV driver escrows payment on Creditcoin Testnet,
an authorized charger signs and anchors a metered session on Ethereum Sepolia, and the charging
operator is paid only after Attestcoin proves that exact source transaction. Any unused escrow is
credited back to the driver.

- **Live demo:** [chargeproof-plum.vercel.app](https://chargeproof-plum.vercel.app)
- **Demo video:** [Watch the 2:55 walkthrough](https://youtu.be/ezp9PUCCaRI)
- **DoraHacks BUIDL:** [dorahacks.io/buidl/48131](https://dorahacks.io/buidl/48131)
- **Source code:** [github.com/tang-vu/ChargeProof](https://github.com/tang-vu/ChargeProof)
- **Pitch deck:** [ChargeProof Deck](https://github.com/tang-vu/ChargeProof/blob/main/submission/ChargeProof-Deck.pdf)

## The problem

EV roaming spans drivers, charge point operators, mobility providers, and payment systems that do not
share one trusted settlement record. A destination-chain contract cannot safely release funds merely
because a relayer claims that charging occurred on another chain. At the same time, a driver should
never pay more than the tariff and maximum amount authorized before charging began.

Existing reconciliation is often centralized, delayed, and difficult to audit. ChargeProof turns a
metered charging session into an authenticated, bounded, and replay-resistant payment.

## How ChargeProof works

1. **Open a bounded intent.** The driver selects a registered station and escrows a maximum amount of
   valueless MockUSDC on Creditcoin Testnet. The tariff, expiry, station payout address, authorized
   device signer, and expected Sepolia source are snapshotted into the intent.
2. **Create a metered receipt.** A clearly labeled virtual charger meters integer watt-hours and
   calculates the final amount without floating-point arithmetic. An isolated device key signs every
   receipt field as EIP-712 typed data.
3. **Anchor the receipt.** The driver submits the signed receipt through one canonical
   `ChargingSessionRegistry` function on Ethereum Sepolia. The source contract checks authorization,
   amount, timing, deterministic session identity, and device nonce.
4. **Generate the proof.** A resumable worker waits for the source block to become attested and uses
   the official Attestcoin SDK and proof service to obtain the encoded transaction, Merkle path, and
   continuity proof.
5. **Verify and settle.** Creditcoin's native Block Prover authenticates the source bytes. ChargeProof
   then revalidates the source chain, canonical contract, caller, function selector, successful receipt
   status, decoded charging receipt, device signature, tariff, amount, expiry, intent, and replay state.
6. **Pay exactly once.** The exact charge becomes withdrawable by the operator, unused escrow becomes
   withdrawable by the driver, and station metrics update atomically. Independent source, intent, and
   session replay keys reject reuse of the same proof.

## Why Attestcoin is essential

Attestcoin is not an ornamental integration. It is the only authenticated bridge between the Sepolia
charging receipt and Creditcoin settlement. Without its transaction-inclusion and continuity proof, a
relayer could invent source calldata and the destination contract would have no trusted cross-chain
input. In ChargeProof, removing Attestcoin makes the settlement path impossible to execute.

ChargeProof also keeps the trust boundary explicit: Attestcoin proves the source-chain transaction,
not physical electricity delivery. For this hackathon MVP, the physical claim is represented by an
authorized device signature from a clearly labeled hardware simulator. Secure-element charger keys,
certified meters, and OCPP/OCPI integration remain production roadmap work.

## Explorer-verifiable result

The project-owned Gate 2 run settled a real testnet flow for a **4.20 kWh** receipt:

- Driver escrow: **5.00 MockUSDC**
- Operator credit: **1.47 MockUSDC**
- Driver refund credit: **3.53 MockUSDC**
- Attestcoin proof: **2,336 bytes, 7 Merkle siblings, and 7 continuity roots**
- Duplicate proof: **mined and reverted with no accounting change**

Public evidence:

- [Funded Creditcoin intent](https://creditcoin-testnet.blockscout.com/tx/0xb9e39a6377a1f491e83b70d6673243cc7093f0d3cf83d9ade015f8ee9583f871)
- [Device-signed Sepolia receipt](https://sepolia.etherscan.io/tx/0x5c7eed57e460be3741746ab469527361fd3f50fe63cd28c07733de0dbfa50938)
- [Successful Creditcoin settlement](https://creditcoin-testnet.blockscout.com/tx/0xc7ad38e06f6462ab880ea638ae9205081435ed89a76581ad66067acb4436514b)
- [Rejected replay transaction](https://creditcoin-testnet.blockscout.com/tx/0xb9155eb1eaaf8bee27c1ce6fd55008442d17c006bfa65240f33513467161daff)
- [Verified Sepolia source contract](https://sourcify.dev/server/repo-ui/11155111/0x1F4E029B8e1FD4291fB96F64C3f12529F1f756fc)
- [Verified Creditcoin escrow contract](https://creditcoin-testnet.blockscout.com/address/0x39349C8539055C3E6fc637651d4Fe3373E3dB988#code)
- [Verified Attestcoin verifier contract](https://creditcoin-testnet.blockscout.com/address/0xA205b6d1BD09ACB1b9575A98a942aCbcFF3CdEf3#code)

Judges can independently re-read all five deployed contract bytecodes, transaction receipts, settled
accounting, station metrics, and replay markers—and then run the local vertical slice—with:

```bash
pnpm install --frozen-lockfile
pnpm judge:verify
```

No wallet or private credential is required for this verification path.

## Security and engineering depth

- Canonical source contract, chain key, sender, and function selector are bound before decoding data.
- Source receipt success is checked independently; transaction inclusion alone cannot authorize
  payment.
- EIP-712 device signatures bind every receipt field.
- Deterministic session identifiers and device nonces prevent source-side duplication.
- Three independent replay domains protect destination settlement.
- Pull-based credits prevent a failed recipient or malicious token callback from blocking settlement.
- Terminal-state accounting conserves escrow across operator payment and driver refund.
- The proof worker persists state by Sepolia transaction hash and safely resumes after interruption.
- **25 automated tests** cover tampering, mismatch, malformed or invalid proof, overcharge, expiry,
  authorization, replay, refunds, accounting, and reentrancy.

The project is not independently audited and is not presented as production-ready. It uses testnets
only, and MockUSDC has no monetary value.

## Architecture and stack

- **Ethereum Sepolia:** canonical device-signed charging-session registry
- **Attestcoin:** official SDK, proof service, transaction inclusion, and continuity proof
- **Creditcoin Testnet:** station registry, bounded escrow, native proof verifier, settlement, refunds,
  and metrics
- **Application:** Next.js App Router dashboard and virtual charger
- **Worker:** resumable TypeScript Attestcoin proof pipeline
- **Contracts:** Solidity with Hardhat tests and public source verification
- **Shared package:** typed ABIs, network configuration, receipt schema, and validation

## Roadmap and broader impact

The next step is a physical pilot using secure-element device keys, certified meter input, and
OCPP/OCPI interoperability. From there, the same authenticated metered-receipt pattern can support
solar microgrids, telecom hotspots, battery swapping, and other DePIN services where one network
records delivery while another settles payment.

ChargeProof deliberately ships one complete, explorer-verifiable EV charging vertical slice instead
of claiming broad but unfinished functionality.
