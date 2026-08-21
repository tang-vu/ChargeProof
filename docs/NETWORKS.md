# Networks and protocol constants

Verified on 2026-08-21 from official documentation, live RPC calls, Chain Info, and the official example.

| Purpose               | Network / service             | Value                                           |
| --------------------- | ----------------------------- | ----------------------------------------------- |
| Execution chain       | Creditcoin Testnet            | Chain ID `102031` (`0x18e8f`)                   |
| Execution RPC         | Creditcoin Testnet            | `https://rpc.cc3-testnet.creditcoin.network`    |
| Execution explorer    | Blockscout                    | `https://creditcoin-testnet.blockscout.com`     |
| Source chain          | Ethereum Sepolia              | Chain ID `11155111`                             |
| Source explorer       | Etherscan                     | `https://sepolia.etherscan.io`                  |
| Attestcoin source key | Sepolia on Creditcoin Testnet | `1`                                             |
| Source encoding       | EVM v1                        | `1`                                             |
| Block Prover          | Creditcoin precompile         | `0x0000000000000000000000000000000000000FD2`    |
| Chain Info            | Creditcoin precompile         | `0x0000000000000000000000000000000000000FD3`    |
| Proof builder         | Official testnet service      | `https://prover.cc3-testnet.creditcoin.network` |
| SDK                   | npm                           | `@gluwa/usc-sdk@0.18.0`                         |
| Contract helpers      | npm                           | `@gluwa/usc-contracts@0.2.0`                    |

Chain keys are protocol identifiers, not EVM chain IDs. Contracts must compare the supplied chain key to
`1`; clients should also query Chain Info before a live run and confirm that key `1` still maps to Sepolia.

The precompiles intentionally report empty bytecode through `eth_getCode`; their availability is provided
by the Creditcoin runtime. Do not use bytecode presence as a production availability check.
