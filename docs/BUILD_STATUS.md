# Build status

Last updated: 2026-08-26

## Completed

- Repository/Git inspection and current official documentation, package, example-source, and live
  network research.
- Gate 1 read-only official proof spike: a real Sepolia transaction was proved through the current SDK
  and accepted by the live Creditcoin Block Prover.
- Original Sepolia charging registry and Creditcoin verifier/escrow/station/token vertical slice.
- Idempotent, atomic, per-transaction attestation worker with live precompile readiness verification.
- Responsive Next.js dashboard, explicit local/live modes, server-only constrained device signer,
  browser transaction/proof resumability, explorer links, decoded evidence, and live settlement metrics.
- Security controls and automated coverage for proof/source/selector/sender/device/receipt/intent/time/
  amount/replay/accounting/transfer/reentrancy boundaries.
- Research, architecture, operations, security, submission copy, deck source, video script, evidence
  template, judging matrix, and final checklist.
- Dedicated testnet-only deployer/device burners created in Git-ignored local files; the helper never
  prints or commits either key.
- Polished ten-slide HTML deck rendered to a visually inspected 16:9 PDF.
- Credential-free GitHub Actions workflow.
- Clean-runner lint ordering hardened: each contract package compiles generated Hardhat types before
  type-aware ESLint; the first public CI run exposed this local-cache dependency.
- Public repository published at `https://github.com/tang-vu/ChargeProof`; credential-free CI passed
  on a clean Ubuntu runner for the Gate 2 automation milestone:
  `https://github.com/tang-vu/ChargeProof/actions/runs/32545636716`.
- Production Vercel dashboard deployed at `https://chargeproof-plum.vercel.app`; the public GitHub
  repository is connected for subsequent builds.
- Resumable `pnpm testnet:gate2` automation now covers both deployments, MockUSDC funding/approval,
  intent opening, deterministic device receipt, Sepolia anchor, real proof wait, settlement, mined
  replay rejection, station metrics, and atomic public evidence output.
- Gate 2 completed on live testnets: five project contracts deployed, a funded intent opened, a
  device-signed 4,200 Wh receipt mined on Sepolia, a 2,336-byte proof accepted by the live Block
  Prover, settlement succeeded, and an identical replay reverted in a mined transaction.
- Public `pnpm evidence:verify` independently checks chain IDs, all runtime bytecodes, deployment and
  flow receipts, canonical source/target selectors, settled intent accounting, station metrics, and
  the replay marker.
- Sepolia registry source verified on Sourcify; MockUSDC, StationRegistry, ChargeIntentEscrow, and
  AttestcoinChargeVerifier sources verified on Creditcoin Testnet Blockscout.
- Production Vercel environment activated with the five public contract addresses and a constrained,
  sensitive server-only demo device key. No deployer or settler key was uploaded. Production returned
  HTTP 200, rendered the `LIVE TESTNET` and historical evidence states, rejected malformed attestation
  input with HTTP 400, and returned a valid 65-byte EIP-712 signature from the authorized device
  signer for a fresh, policy-compliant receipt.
- Final desktop and true 390 px device-emulated production screenshots were inspected. The 390 px
  document and viewport widths matched exactly, with no horizontal overflow.
- Reproducible demo-video pipeline added: ten deck pages and three production dashboard views render
  at 1920×1080; nine exact English narration scenes total 412 words; MiMo V2.5 TTS output is checked
  scene-by-scene with MiMo V2.5 ASR word error rate; FFmpeg emits H.264/AAC with English subtitles.
- Credential-free silent composition rendered and inspected successfully: 178.02 seconds, 1920×1080,
  H.264 video, 48 kHz stereo AAC, `mov_text` English subtitle track, and nine ordered scenes. Generated
  media is Git-ignored and is not presented as the final narrated demo.
- Final MiMo V2.5 narration regenerated with the dedicated `Milo` voice after shortening the three
  least intelligible scenes and adding explicit product-name pronunciation guidance. All nine source
  WAVs passed MiMo V2.5 ASR validation at 5.4% aggregate word error rate against an 18% maximum.
- The MiMo client now retries transient network, rate-limit, server, and response-body timeout failures;
  `--tts-only --scene=<id>` permits a bad single take to be replaced without regenerating the full set.
- Final local upload candidate rendered at 174.90 seconds: 1920×1080 H.264 at 30 fps, 48 kHz mono AAC,
  English `mov_text` subtitles, 8,971,242 bytes, and SHA-256
  `de10854284ac1f608828f9dac1b7ff0d3d5f9b485d2e803992f35b4f03e26162`. Integrated loudness is
  -17.30 LUFS with a -1.42 dB true peak after per-scene normalization. No black interval of 0.3 seconds
  or longer and no silence interval of 1.5 seconds or longer was detected; six representative frames
  were visually inspected. The generated MP4 remains Git-ignored; the upload is hosted separately on
  YouTube.
- The final time-compressed audio was extracted back out of all nine rendered video segments and sent
  through MiMo V2.5 ASR again. Every post-processed segment passed independently at 5.7% aggregate WER;
  the settlement scene scored 1.8% and the proof scene 2.2%. This validates the audio judges will hear, not only the
  pre-render TTS WAV files.
- The final demo was uploaded to YouTube at `https://youtu.be/ezp9PUCCaRI`. Anonymous access returned
  the expected ChargeProof title on 2026-08-27; a final end-to-end human playback review remains open.
- The DoraHacks BUIDL profile, details, team, contact, DePIN track, and USC-specific submission fields
  were completed and submitted on 2026-08-27. Personal team/contact values are not copied into the
  public repository. The user-provided public submission URL is `https://dorahacks.io/buidl/48131`;
  DoraHacks returned HTTP 405 to automated verification, so anonymous browser access is not
  independently claimed here.
- GitHub repository metadata was finalized through authenticated GitHub CLI: public description,
  Vercel homepage, and Attestcoin, Creditcoin, DePIN, EV charging, cross-chain, Solidity, Next.js, and
  hackathon topics are present.
- DoraHacks BUIDL profile fields were prepared in copy-ready English. The project logo was derived
  from the dashboard's existing energy mark and visually inspected at the required 480 x 480 size;
  the optimized PNG is 74,731 bytes, safely below the 2 MB upload limit.
- Hackathon readiness was re-audited against the current official event page and emerging public
  competition. The dashboard now exposes project-owned live source, settlement, accounting, proof,
  and replay evidence above the interactive workflow, with direct explorer links and a no-wallet path.
- Added `pnpm judge:verify`: a credential-free command that re-reads all five deployed contract
  bytecodes, flow receipts, settled intent, station metrics, and replay marker before running the local
  vertical-slice integration tests.
- The evidence verifier now bounds individual RPC waits, retries null and transient responses, avoids
  burst-loading historical endpoints, and falls back from the official Creditcoin RPC to the public
  Blockscout RPC. A live run recovered from transient Sepolia receipt misses and passed.
- Removed the Next.js build-time Google Fonts dependency. Manrope and IBM Plex Mono are bundled from
  Fontsource packages, so an unavailable font CDN no longer turns an otherwise reproducible build red.
- Added generated Open Graph/Twitter presentation metadata, a 1200×630 social card, and a favicon for
  stronger DoraHacks, chat, and social link previews.
- Expanded contract coverage to 25 total repository tests: explicit alternate-session device nonce
  replay, tariff mismatch, nondeterministic session ID, and incorrect exact-metering amount checks.
- Visually inspected the updated 1920×1080 local dashboard hero and workflow captures. The evidence
  strip remains legible, clearly labeled as project-owned historical testnet evidence, and does not
  represent the local interactive path as live.

## In progress

- Final end-to-end human playback review as a post-submission verification.

## Blocked

- None for engineering/evidence. Source verification succeeded through Sourcify and Blockscout.
- The MiMo key pasted into chat was treated as compromised and never used. A replacement key was read
  only from the Git-ignored local environment for the one-off interactive TTS/ASR run; no key value was
  printed, serialized, committed, or sent to the browser.

No private key, seed, or credential has been requested or exposed.

## Gate 1 evidence

| Check                    | Result                                                      |
| ------------------------ | ----------------------------------------------------------- |
| Creditcoin `eth_chainId` | `102031`                                                    |
| Live Sepolia mapping     | chain key `1` -> chain ID `11155111`, encoding `1`          |
| Official source receipt  | status `1`, block `11073054`, transaction index `216`       |
| SDK proof                | 1,920 encoded bytes, 8 Merkle siblings, 47 continuity roots |
| Live `verifySingle`      | `true`                                                      |
| Official target receipt  | status `1`                                                  |

Source: `0xce785c35e300d607d83da9564990c4d2aaf45dafc68ef76539d97aee3de6859b`<br>
Target: `0x7cc3a7333e9522f5921e6430bd59192caf7e1ce2382ae022879da93cd4ae9388`

These are attributed official-example transactions, not ChargeProof settlement evidence.

## Gate 2 project-owned evidence

| Check                       | Result                                                     |
| --------------------------- | ---------------------------------------------------------- |
| Sepolia source receipt      | status `1`, block `11539874`, transaction index `78`       |
| SDK proof                   | 2,336 encoded bytes, 7 Merkle siblings, 7 continuity roots |
| Live `verifySingle`         | `true`                                                     |
| Creditcoin settlement       | status `1`, block `5351717`                                |
| Identical replay            | status `0`, block `5351718`                                |
| Accounting                  | 1.47 station credit + 3.53 driver refund from 5.00 escrow  |
| Station metrics             | 1 session, 4,200 Wh, 1.47 MockUSDC value                   |
| Independent evidence script | passed; five runtime contracts and replay marker confirmed |

Source: `0x5c7eed57e460be3741746ab469527361fd3f50fe63cd28c07733de0dbfa50938`<br>
Settlement: `0xc7ad38e06f6462ab880ea638ae9205081435ed89a76581ad66067acb4436514b`<br>
Replay: `0xb9155eb1eaaf8bee27c1ce6fd55008442d17c006bfa65240f33513467161daff`

## Quality gates actually run

Latest credential-free full run on 2026-08-26:

| Gate                             | Result                                                                            |
| -------------------------------- | --------------------------------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Passed; lockfile already current                                                  |
| `pnpm format:check`              | Passed                                                                            |
| `pnpm lint`                      | Passed for root scripts and five workspace projects                               |
| `pnpm typecheck`                 | Passed in strict mode                                                             |
| `pnpm compile`                   | Passed; Solidity 0.8.28, Cancun target                                            |
| `pnpm test`                      | Passed: 25 tests (5 Sepolia, 9 Creditcoin, 6 worker, 3 shared, 2 web)             |
| `pnpm integration:local`         | Passed source success, target escrow settlement, and worker state machine         |
| `pnpm build`                     | Passed; contracts, shared, worker, and Next.js production build                   |
| `pnpm secret:scan`               | Passed for 112 repository files                                                   |
| `pnpm audit --prod`              | No known vulnerabilities found                                                    |
| `pnpm judge:verify`              | Passed public live-evidence reads plus the credential-free local integration path |
| Responsive visual inspection     | Updated 1920×1080 hero/workflow inspected; prior 390 px inspection retained       |

The final `pnpm check` command completed successfully after the 2026-08-26 evidence-first UI,
reproducibility, metadata, and test changes. `pnpm audit --prod` also reported no known vulnerabilities.

## Commands actually run

```text
git status --short --branch
git log -5 --oneline
node --version
npm --version
pnpm --version
git clone --depth 1 https://github.com/gluwa/usc-testnet-bridge-examples.git <temporary-dir>
npm view @gluwa/usc-sdk version repository.url dist.tarball --json
npm install --prefix <temporary-dir> @gluwa/usc-sdk@0.18.0 @gluwa/usc-contracts@0.2.0
pnpm install --frozen-lockfile
pnpm proof:resume -- 0xce785c35e300d607d83da9564990c4d2aaf45dafc68ef76539d97aee3de6859b
pnpm wallets:create
pnpm wallets:status
pnpm testnet:gate2
pnpm evidence:verify
pnpm check
pnpm audit --prod
pnpm video:visuals
pnpm video:audio -- --force --tts-only
pnpm video:audio -- --asr-only
pnpm video:render
pnpm video:verify
pnpm --filter @chargeproof/contracts-sepolia exec hardhat verify sourcify --network sepolia --creation-tx-hash <PUBLIC_DEPLOYMENT_TX> <PUBLIC_CONTRACT> <PUBLIC_OWNER>
pnpm --filter @chargeproof/contracts-creditcoin exec hardhat verify blockscout --network creditcoinTestnet <PUBLIC_CONTRACT> <PUBLIC_CONSTRUCTOR_ARGS>
npx --yes vercel@latest env add <PUBLIC_DEPLOYMENT_VARIABLE> production --value <PUBLIC_ADDRESS> --no-sensitive --yes
npx --yes vercel@latest env add DEVICE_SIMULATOR_PRIVATE_KEY production --sensitive --yes < <IGNORED_LOCAL_VALUE>
npx --yes vercel@latest deploy --prod --yes --logs
```

Live work also used JSON-RPC, the proof service, SDK proof builder, Chain Info and Block Prover calls.
All state-changing operations were confined to Ethereum Sepolia and Creditcoin Testnet. No private key
was printed, serialized into public evidence, committed, or sent to a browser.
