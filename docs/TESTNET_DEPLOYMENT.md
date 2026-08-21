# Testnet deployment

Only Ethereum Sepolia and Creditcoin Testnet are supported. These instructions must never be pointed
at mainnet.

## Wallet separation

Use dedicated burner accounts:

1. a Sepolia deployer/driver with Sepolia ETH;
2. a Creditcoin deployer/driver with testnet CTC;
3. a device signer with no funds and no transaction role;
4. optionally, a separate permissionless Creditcoin proof submitter.

The device signer address is public; its private key stays in a server-only environment. Never paste a
private key into chat or a browser field.

## Preflight

```bash
pnpm install --frozen-lockfile
pnpm check
```

Confirm the wallet balance and chain ID with a read-only wallet or explorer. Confirm the deployment
JSON still has `"status": "not-deployed"`; scripts refuse to silently overwrite a known live
deployment and check code when metadata already describes one.

## 1. Deploy Sepolia source registry

Provide these local environment variables:

```text
SEPOLIA_DEPLOYER_PRIVATE_KEY=<testnet burner only>
DEVICE_SIGNER_ADDRESS=<address derived from the isolated device key>
```

Then run:

```bash
pnpm --filter @chargeproof/contracts-sepolia deploy:sepolia
```

The script deploys `ChargingSessionRegistry`, configures the demo station/device, and writes
`deployments/sepolia.json`. Verify the address has bytecode and open its explorer link. Source
verification can then use the explorer's supported Hardhat/API workflow; record the verification URL
without claiming success until it is public.

## 2. Deploy Creditcoin contracts

Provide:

```text
CREDITCOIN_DEPLOYER_PRIVATE_KEY=<testnet burner only>
STATION_PAYOUT_ADDRESS=<testnet recipient>
DEVICE_SIGNER_ADDRESS=<same signer as Sepolia>
SEPOLIA_REGISTRY_ADDRESS=<deployed canonical registry>
```

Run:

```bash
pnpm --filter @chargeproof/contracts-creditcoin deploy:creditcoin-testnet
```

The script deploys `MockUSDC`, `StationRegistry`, `ChargeIntentEscrow`, and
`AttestcoinChargeVerifier`, binds the one-time verifier/metrics roles, and writes
`deployments/creditcoin-testnet.json`. On chain ID `102031`, the verifier constructor refuses any
Block Prover address other than `0x0000000000000000000000000000000000000FD2`.

## 3. Configure the web application

Copy the public deployed addresses into an ignored `apps/web/.env.local` using the names in
`.env.example`. Add the server-only `DEVICE_SIMULATOR_PRIVATE_KEY`. The dashboard enables **Live
testnet** only when every required address is syntactically valid.

```bash
pnpm --filter @chargeproof/web build
pnpm --filter @chargeproof/web start
```

## 4. Run the custom vertical slice

1. Connect the same driver address on Creditcoin and Sepolia.
2. Faucet MockUSDC, approve escrow, and open the intent.
3. Run the virtual charger and obtain the device signature from the server endpoint.
4. Submit `finalizeSession` on Sepolia and retain its transaction hash.
5. Resume proof generation until `PROOF_READY`.
6. Submit `verifyAndSettle` on Creditcoin and retain its transaction hash.
7. Withdraw station/refund claims.
8. Submit the same proof again and record the expected replay revert without altering state.

Update both deployment JSON files and `submission/EVIDENCE.md` with explorer-verifiable facts only.

## Recovery

- **Source pending:** do not create another receipt with the same session/nonce. Speed up through the
  wallet only if the wallet supports a same-nonce replacement.
- **Attestation pending:** close the UI safely; resume with the exact source hash later.
- **Proof API unavailable:** keep state, retry; do not switch to fabricated proof bytes.
- **Settlement submitted:** check the stored target hash before resubmitting.
- **Deployment interrupted:** inspect bytecode, nonce history, and JSON before rerunning. Do not delete
  deployment metadata to force a new deployment.

## Human-only success checks

- Wallet confirms the expected network and contract in every signature dialog.
- Both contract addresses show bytecode on their explorers.
- Sepolia source receipt status is successful and calldata decodes to the expected function.
- Worker reports `precompileVerified: true` from the live Creditcoin RPC.
- Target receipt status is successful and escrow/metrics events match the receipt.
- Replay transaction reverts and the first settlement remains unchanged.
