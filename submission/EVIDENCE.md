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
Git-ignored local environment files. Both required native balances were zero when checked on
2026-08-21, so no project-owned transaction is claimed below.

## Gate 2 — ChargeProof custom vertical slice

| Purpose                   | Network            | Contract                   | Transaction hash   | Explorer URL | Expected result                              | Status                    |
| ------------------------- | ------------------ | -------------------------- | ------------------ | ------------ | -------------------------------------------- | ------------------------- |
| Deploy canonical registry | Ethereum Sepolia   | `ChargingSessionRegistry`  | `[PENDING]`        | `[PENDING]`  | Runtime bytecode and configured demo station | Blocked: Sepolia gas      |
| Deploy escrow stack       | Creditcoin Testnet | four ChargeProof contracts | `[PENDING]`        | `[PENDING]`  | Runtime bytecode and immutable bindings      | Blocked: Creditcoin gas   |
| Open funded intent        | Creditcoin Testnet | `ChargeIntentEscrow`       | `[PENDING]`        | `[PENDING]`  | `IntentOpened`, max payment escrowed         | Blocked: deployment       |
| Anchor custom receipt     | Ethereum Sepolia   | `ChargingSessionRegistry`  | `[PENDING]`        | `[PENDING]`  | status `1`, expected selector/calldata       | Blocked: deployment       |
| Generate custom proof     | Attestcoin         | proof service + `0x…0FD2`  | source `[PENDING]` | `[PENDING]`  | real proof and `verifySingle = true`         | Blocked: source tx        |
| Settle escrow             | Creditcoin Testnet | `AttestcoinChargeVerifier` | `[PENDING]`        | `[PENDING]`  | operator/refund credits and metrics          | Blocked: custom proof     |
| Reject replay             | Creditcoin Testnet | `AttestcoinChargeVerifier` | `[PENDING]`        | `[PENDING]`  | revert; no accounting change                 | Blocked: first settlement |

## Deployment addresses

Canonical machine-readable source: `deployments/sepolia.json` and
`deployments/creditcoin-testnet.json`. Both currently state `not-deployed`; there is no seeded previous
settlement until a real Gate 2 run exists.

## Evidence acceptance checklist

For every future row:

- transaction hash is 32 bytes and explorer page loads;
- explorer network matches the row;
- receipt status and target contract match expectation;
- critical input/event values decode correctly;
- address matches deployment JSON and deployed bytecode exists;
- expected failure does not mutate escrow or replay state;
- no secret, private RPC token, local path, or private key is included.
