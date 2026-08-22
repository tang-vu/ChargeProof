# Evidence

Only public, independently verifiable evidence belongs here. Official example evidence demonstrates
protocol compatibility and is separated from ChargeProof-owned evidence.

## Gate 1 — official Attestcoin proof spike

| Purpose                         | Network                  | Contract/endpoint                                                    | Transaction or result                                                                                                              | Expected result                                   | What it proves                                 |
| ------------------------------- | ------------------------ | -------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- | ---------------------------------------------- |
| Inspect official source tx      | Ethereum Sepolia         | Official example source `0x0f24fd9e0524ba53d3f0a4a40350adf5370b4a53` | [`0xce785c…859b`](https://sepolia.etherscan.io/tx/0xce785c35e300d607d83da9564990c4d2aaf45dafc68ef76539d97aee3de6859b)              | Receipt status `1`, block `11073054`, index `216` | A real supported source transaction exists     |
| Generate proof                  | Attestcoin proof service | `prover.cc3-testnet.creditcoin.network`                              | 1,920 tx bytes; 8 Merkle siblings; 47 continuity roots                                                                             | SDK `ProofBuilder.getProof` succeeds              | Current SDK and proof API accept the source tx |
| Verify proof read-only          | Creditcoin Testnet       | Block Prover `0x…0FD2`                                               | `verifySingle = true`                                                                                                              | Native verifier accepts generated proof           | Live proof/precompile compatibility            |
| Inspect official destination tx | Creditcoin Testnet       | Official example target `0x2be9b8640ed32815d3b9e8c92abcd3f15f07396f` | [`0x7cc3a7…9388`](https://creditcoin-testnet.blockscout.com/tx/0x7cc3a7333e9522f5921e6430bd59192caf7e1ce2382ae022879da93cd4ae9388) | Receipt status `1`                                | Official example flow reached target chain     |

The above transactions are owned by the official example project, not ChargeProof. They must not be
presented as project-specific settlement evidence.

The dedicated Gate 2 deployer is `0x33c7dE76ECCA5293D8d5Ee4aC6e8765213418267`. Its keys exist only in
Git-ignored local environment files. It signed project-owned testnet transactions on 2026-08-22; no
private key or secret is present in this evidence.

## Product evidence

| Purpose          | Environment | URL                                                                              | Expected result                                        | What it proves                                  |
| ---------------- | ----------- | -------------------------------------------------------------------------------- | ------------------------------------------------------ | ----------------------------------------------- |
| Hosted dashboard | Vercel      | [ChargeProof](https://chargeproof-plum.vercel.app)                               | HTTP 200; visible `LIVE TESTNET` badge                 | Public UI bound to deployed contracts           |
| Public CI        | GitHub      | [Quality gates](https://github.com/tang-vu/ChargeProof/actions/runs/32472627378) | Green clean-runner job for the Gate 2 runner milestone | Reproducibility outside the development machine |

## Gate 2 — ChargeProof custom vertical slice

| Purpose                   | Network            | Contract                   | Transaction hash                                                                                                                    | Expected result                                               | Observed result                                   |
| ------------------------- | ------------------ | -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------------------------------------- |
| Deploy canonical registry | Ethereum Sepolia   | `ChargingSessionRegistry`  | [`0x565a0a…c8c60`](https://sepolia.etherscan.io/tx/0x565a0aaaac9dc7354de9fc254a188624ab249bc757861769cee2bed1b57c8c60)              | Runtime bytecode and configured demo station                  | Success; code at `0x1F4E…56fc`                    |
| Deploy escrow stack       | Creditcoin Testnet | four ChargeProof contracts | [`0x845f77…5d12e`](https://creditcoin-testnet.blockscout.com/tx/0x845f776c10eefa17c45f79e1f128100b58080febe53e78d71c3fbe8caf85d12e) | Runtime bytecode and immutable source/precompile bindings     | Success; all four runtime bytecodes verified      |
| Open funded intent        | Creditcoin Testnet | `ChargeIntentEscrow`       | [`0xb9e39a…3f871`](https://creditcoin-testnet.blockscout.com/tx/0xb9e39a6377a1f491e83b70d6673243cc7093f0d3cf83d9ade015f8ee9583f871) | `IntentOpened`, 5.00 MockUSDC maximum escrowed                | Success; intent later reached `Settled`           |
| Anchor custom receipt     | Ethereum Sepolia   | `ChargingSessionRegistry`  | [`0x5c7eed…0938`](https://sepolia.etherscan.io/tx/0x5c7eed57e460be3741746ab469527361fd3f50fe63cd28c07733de0dbfa50938)               | status `1`, canonical target and exact `finalizeSession` call | Success; block `11539874`, transaction index `78` |
| Generate custom proof     | Attestcoin         | proof service + `0x…0FD2`  | Source [`0x5c7eed…0938`](https://sepolia.etherscan.io/tx/0x5c7eed57e460be3741746ab469527361fd3f50fe63cd28c07733de0dbfa50938)        | real proof and `verifySingle = true`                          | 2,336 bytes; 7 siblings; 7 roots; verified        |
| Settle escrow             | Creditcoin Testnet | `AttestcoinChargeVerifier` | [`0xc7ad38…6514b`](https://creditcoin-testnet.blockscout.com/tx/0xc7ad38e06f6462ab880ea638ae9205081435ed89a76581ad66067acb4436514b) | station/refund credits and metrics                            | Success; block `5351717`; 1.47 / 3.53 MockUSDC    |
| Reject replay             | Creditcoin Testnet | `AttestcoinChargeVerifier` | [`0xb9155e…1daff`](https://creditcoin-testnet.blockscout.com/tx/0xb9155eb1eaaf8bee27c1ce6fd55008442d17c006bfa65240f33513467161daff) | mined revert; no accounting change                            | Reverted; block `5351718`; metrics unchanged      |

The public evidence verifier independently re-read both RPCs after the run. It found runtime code at
all five project contracts, source/settlement receipt status `1`, replay receipt status `0`, a settled
intent, the session replay marker set, one completed session, 4,200 Wh, and 1,470,000 base units of
station value. Reproduce with `pnpm evidence:verify`.

## Deployment addresses

Canonical machine-readable sources are `deployments/sepolia.json`,
`deployments/creditcoin-testnet.json`, and `deployments/gate2-evidence.json`.

| Network            | Contract                   | Address                                      |
| ------------------ | -------------------------- | -------------------------------------------- |
| Ethereum Sepolia   | `ChargingSessionRegistry`  | `0x1F4E029B8e1FD4291fB96F64C3f12529F1f756fc` |
| Creditcoin Testnet | `MockUSDC`                 | `0x1F4E029B8e1FD4291fB96F64C3f12529F1f756fc` |
| Creditcoin Testnet | `StationRegistry`          | `0xc56e90697F04F1E5D46816205D8cd69Da4341c6c` |
| Creditcoin Testnet | `ChargeIntentEscrow`       | `0x39349C8539055C3E6fc637651d4Fe3373E3dB988` |
| Creditcoin Testnet | `AttestcoinChargeVerifier` | `0xA205b6d1BD09ACB1b9575A98a942aCbcFF3CdEf3` |

Source verification:

- Sepolia registry: [Sourcify verified source](https://sourcify.dev/server/repo-ui/11155111/0x1F4E029B8e1FD4291fB96F64C3f12529F1f756fc)
- Creditcoin token: [Blockscout verified source](https://creditcoin-testnet.blockscout.com/address/0x1F4E029B8e1FD4291fB96F64C3f12529F1f756fc#code)
- Creditcoin station registry: [Blockscout verified source](https://creditcoin-testnet.blockscout.com/address/0xc56e90697F04F1E5D46816205D8cd69Da4341c6c#code)
- Creditcoin escrow: [Blockscout verified source](https://creditcoin-testnet.blockscout.com/address/0x39349C8539055C3E6fc637651d4Fe3373E3dB988#code)
- Creditcoin verifier: [Blockscout verified source](https://creditcoin-testnet.blockscout.com/address/0xA205b6d1BD09ACB1b9575A98a942aCbcFF3CdEf3#code)

## Evidence acceptance checklist

For every row:

- transaction hash is 32 bytes and explorer page loads;
- explorer network matches the row;
- receipt status and target contract match expectation;
- critical input/event values decode correctly;
- address matches deployment JSON and deployed bytecode exists;
- expected failure does not mutate escrow or replay state;
- no secret, private RPC token, local path, or private key is included.
