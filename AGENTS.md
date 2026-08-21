# ChargeProof agent guide

## Repository map

- `apps/web`: Next.js App Router dashboard and virtual charger.
- `services/attestation-worker`: resumable Attestcoin proof CLI/service logic.
- `packages/contracts-sepolia`: canonical charging-session source contract.
- `packages/contracts-creditcoin`: escrow, verifier, station registry, and demo token.
- `packages/shared`: typed ABIs, receipt schema, networks, and validation.
- `deployments`: public testnet deployment metadata only.
- `docs`: architecture, security, operations, and evidence boundaries.
- `submission`: copy-ready hackathon materials.

## Commands

Use pnpm only. Run `pnpm install`, `pnpm check`, or the narrower `pnpm lint`,
`pnpm typecheck`, `pnpm test`, `pnpm compile`, and `pnpm build` commands.

## Security constraints

- Testnets only. Never send a mainnet transaction.
- Never commit, print, log, or request private keys, mnemonics, API secrets, or wallet exports.
- Browser code must never receive a device or deployer private key.
- Label local and mocked flows as `Local simulation`; never present them as live evidence.
- Treat Attestcoin as transaction inclusion plus continuity proof. Verify receipt status and all
  ChargeProof business invariants in the target contract.
- Only mock the `0x0FD2` precompile boundary in unit tests. Keep mock and live evidence separate.
- Preserve unrelated user changes and never overwrite deployment metadata silently.

## Definition of done

The vertical slice is complete only when contract tests and application checks pass, the proof worker
can resume from a Sepolia transaction hash, a real proof settles a funded Creditcoin testnet intent,
replay fails, explorer evidence is recorded, and remaining human-only actions are explicit.

## Documentation

Update `PLANS.md` and `docs/BUILD_STATUS.md` whenever implementation reality changes. Record only
commands that actually ran and evidence that is independently verifiable.
