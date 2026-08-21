'use client';

import { readContract, waitForTransactionReceipt } from '@wagmi/core';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { encodePacked, formatUnits, keccak256, type Address, type Hex } from 'viem';
import { useAccount, useConnect, useDisconnect, useSwitchChain, useWriteContract } from 'wagmi';

import {
  CREDITCOIN_TESTNET_CHAIN_ID,
  DEMO_MAX_PAYMENT,
  DEMO_STATION_ID,
  DEMO_TARIFF,
  DEMO_TARGET_ENERGY_WH,
  SEPOLIA_ATTESTCOIN_CHAIN_KEY,
  SEPOLIA_CHAIN_ID,
  attestcoinChargeVerifierAbi,
  calculateFinalAmount,
  calculateSessionId,
  chargeIntentEscrowAbi,
  chargingSessionRegistryAbi,
  explorerTransactionUrl,
  mockUsdcAbi,
  proofContractArguments,
  stationRegistryAbi,
  type AttestcoinProofData,
} from '@chargeproof/shared';

import { deployments, liveDeploymentReady } from '../lib/deployments';
import { wagmiConfig } from '../lib/wagmi';

const STORAGE_KEY = 'chargeproof.live-run.v1';

type StoredReceipt = {
  intentId: Hex;
  sessionId: Hex;
  stationId: Hex;
  driver: Address;
  startedAt: string;
  endedAt: string;
  energyWh: string;
  tariff: string;
  finalAmount: string;
  nonce: string;
};

type LiveRun = {
  intentId?: Hex;
  expiresAt?: string;
  intentTransactionHash?: Hex;
  intentBlockNumber?: number;
  receipt?: StoredReceipt;
  deviceSignature?: Hex;
  deviceSigner?: Address;
  receiptDigest?: Hex;
  sourceTransactionHash?: Hex;
  sourceBlockNumber?: number;
  attestationPhase?: string;
  latestAttestedHeight?: number;
  proof?: AttestcoinProofData;
  settlementTransactionHash?: Hex;
  settlementBlockNumber?: number;
  stationPayout?: Address;
  stationCompletedSessions?: string;
  stationSuccessfulSettlements?: string;
  stationTotalEnergyWh?: string;
  stationTotalValueSettled?: string;
  operatorClaimable?: string;
  driverClaimable?: string;
};

type ActionState = { label: string; error?: string };

export function ChargeProofDashboard() {
  const account = useAccount();
  const { connectors, connect, isPending: connecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();
  const [run, setRun] = useState<LiveRun>({});
  const [energyWh, setEnergyWh] = useState(0n);
  const [charging, setCharging] = useState(false);
  const [localPreview, setLocalPreview] = useState(false);
  const [action, setAction] = useState<ActionState>({ label: 'Ready' });
  const startedAtRef = useRef<bigint>(0n);

  useEffect(() => {
    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (!saved) return;
    try {
      setRun(JSON.parse(saved) as LiveRun);
    } catch {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(run));
  }, [run]);

  useEffect(() => {
    if (!charging) return;
    const timer = window.setInterval(() => {
      setEnergyWh((current) => {
        const next = current + 70n;
        if (next >= DEMO_TARGET_ENERGY_WH) {
          window.clearInterval(timer);
          setCharging(false);
          return DEMO_TARGET_ENERGY_WH;
        }
        return next;
      });
    }, 90);
    return () => window.clearInterval(timer);
  }, [charging]);

  const finalAmount = calculateFinalAmount(energyWh, DEMO_TARIFF);
  const completion = Number((energyWh * 100n) / DEMO_TARGET_ENERGY_WH);
  const liveMode = liveDeploymentReady;

  const updateRun = useCallback((patch: Partial<LiveRun>) => {
    setRun((current) => ({ ...current, ...patch }));
  }, []);

  const createIntentId = useCallback((): Hex => {
    const driver = account.address ?? '0x0000000000000000000000000000000000000000';
    const entropy = new Uint32Array(1);
    window.crypto.getRandomValues(entropy);
    return keccak256(
      encodePacked(['address', 'uint64', 'uint32'], [driver, BigInt(Date.now()), entropy[0] ?? 0]),
    );
  }, [account.address]);

  async function withAction<T>(label: string, operation: () => Promise<T>): Promise<T | undefined> {
    setAction({ label });
    try {
      const value = await operation();
      setAction({ label: 'Ready' });
      return value;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setAction({ label: 'Action failed', error: compactError(message) });
      return undefined;
    }
  }

  async function requestFaucet() {
    if (!deployments.mockUsdc) return;
    await withAction('Minting demo cpUSDC…', async () => {
      await switchChainAsync({ chainId: CREDITCOIN_TESTNET_CHAIN_ID });
      const hash = await writeContractAsync({
        chainId: CREDITCOIN_TESTNET_CHAIN_ID,
        address: deployments.mockUsdc!,
        abi: mockUsdcAbi,
        functionName: 'faucet',
      });
      await waitForTransactionReceipt(wagmiConfig, { chainId: CREDITCOIN_TESTNET_CHAIN_ID, hash });
    });
  }

  async function openIntent() {
    if (!account.address || !deployments.mockUsdc || !deployments.escrow || !deployments.sepoliaRegistry) {
      return;
    }
    await withAction('Funding charging intent…', async () => {
      let intentHash = run.intentTransactionHash;
      if (!intentHash) {
        const nextIntentId = createIntentId();
        const expiresAt = BigInt(Math.floor(Date.now() / 1_000) + 7_200);
        await switchChainAsync({ chainId: CREDITCOIN_TESTNET_CHAIN_ID });
        const approvalHash = await writeContractAsync({
          chainId: CREDITCOIN_TESTNET_CHAIN_ID,
          address: deployments.mockUsdc!,
          abi: mockUsdcAbi,
          functionName: 'approve',
          args: [deployments.escrow!, DEMO_MAX_PAYMENT],
        });
        await waitForTransactionReceipt(wagmiConfig, {
          chainId: CREDITCOIN_TESTNET_CHAIN_ID,
          hash: approvalHash,
        });
        intentHash = await writeContractAsync({
          chainId: CREDITCOIN_TESTNET_CHAIN_ID,
          address: deployments.escrow!,
          abi: chargeIntentEscrowAbi,
          functionName: 'openIntent',
          args: [
            nextIntentId,
            DEMO_STATION_ID,
            DEMO_MAX_PAYMENT,
            DEMO_TARIFF,
            expiresAt,
            BigInt(SEPOLIA_ATTESTCOIN_CHAIN_KEY),
            deployments.sepoliaRegistry!,
          ],
        });
        setRun({
          intentId: nextIntentId,
          expiresAt: expiresAt.toString(),
          intentTransactionHash: intentHash,
        });
        setEnergyWh(0n);
      }
      const opened = await waitForTransactionReceipt(wagmiConfig, {
        chainId: CREDITCOIN_TESTNET_CHAIN_ID,
        hash: intentHash,
      });
      if (opened.status !== 'success') throw new Error('Creditcoin intent transaction reverted');
      updateRun({ intentBlockNumber: Number(opened.blockNumber) });
    });
  }

  function startCharger() {
    const nextIntentId = run.intentId ?? createIntentId();
    const startedAt = BigInt(Math.floor(Date.now() / 1_000));
    startedAtRef.current = startedAt;
    setLocalPreview(!liveMode);
    setRun((current) => {
      const next = { ...current, intentId: nextIntentId };
      delete next.receipt;
      delete next.deviceSignature;
      delete next.deviceSigner;
      delete next.receiptDigest;
      delete next.sourceTransactionHash;
      delete next.sourceBlockNumber;
      delete next.proof;
      delete next.settlementTransactionHash;
      delete next.settlementBlockNumber;
      delete next.stationPayout;
      delete next.stationCompletedSessions;
      delete next.stationSuccessfulSettlements;
      delete next.stationTotalEnergyWh;
      delete next.stationTotalValueSettled;
      delete next.operatorClaimable;
      delete next.driverClaimable;
      return next;
    });
    setEnergyWh(0n);
    setCharging(true);
  }

  async function sealReceipt() {
    if (!account.address || !run.intentId || !deployments.sepoliaRegistry) return;
    await withAction('Requesting device signature…', async () => {
      const endedAt = BigInt(Math.floor(Date.now() / 1_000));
      const startedAt = startedAtRef.current || endedAt - 300n;
      const nonceBytes = new Uint32Array(1);
      window.crypto.getRandomValues(nonceBytes);
      const nonce = BigInt(nonceBytes[0] ?? 1);
      const sessionId = calculateSessionId(
        run.intentId!,
        DEMO_STATION_ID,
        account.address!,
        startedAt,
        nonce,
      );
      const receipt: StoredReceipt = {
        intentId: run.intentId!,
        sessionId,
        stationId: DEMO_STATION_ID,
        driver: account.address!,
        startedAt: startedAt.toString(),
        endedAt: endedAt.toString(),
        energyWh: energyWh.toString(),
        tariff: DEMO_TARIFF.toString(),
        finalAmount: calculateFinalAmount(energyWh, DEMO_TARIFF).toString(),
        nonce: nonce.toString(),
      };
      const response = await fetch('/api/device/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sourceRegistry: deployments.sepoliaRegistry, receipt }),
      });
      const result = (await response.json()) as {
        signer?: Address;
        signature?: Hex;
        digest?: Hex;
        message?: string;
      };
      if (!response.ok || !result.signature || !result.signer || !result.digest) {
        throw new Error(result.message ?? 'Device signer rejected the receipt');
      }
      updateRun({
        receipt,
        deviceSignature: result.signature,
        deviceSigner: result.signer,
        receiptDigest: result.digest,
      });
    });
  }

  async function anchorOnSepolia() {
    if (!deployments.sepoliaRegistry || !run.receipt || !run.deviceSignature) return;
    await withAction('Anchoring receipt on Sepolia…', async () => {
      let hash = run.sourceTransactionHash;
      if (!hash) {
        await switchChainAsync({ chainId: SEPOLIA_CHAIN_ID });
        hash = await writeContractAsync({
          chainId: SEPOLIA_CHAIN_ID,
          address: deployments.sepoliaRegistry!,
          abi: chargingSessionRegistryAbi,
          functionName: 'finalizeSession',
          args: [toContractReceipt(run.receipt!), run.deviceSignature!],
        });
        updateRun({ sourceTransactionHash: hash, attestationPhase: 'SOURCE_PENDING' });
      }
      const mined = await waitForTransactionReceipt(wagmiConfig, { chainId: SEPOLIA_CHAIN_ID, hash });
      if (mined.status !== 'success') throw new Error('Sepolia source transaction reverted');
      updateRun({
        sourceTransactionHash: hash,
        sourceBlockNumber: Number(mined.blockNumber),
        attestationPhase: 'WAITING_ATTESTATION',
      });
    });
  }

  async function refreshAttestation() {
    if (!run.sourceTransactionHash) return;
    await withAction('Checking Attestcoin proof state…', async () => {
      const response = await fetch(`/api/attestation/${run.sourceTransactionHash}`, { cache: 'no-store' });
      const state = (await response.json()) as {
        phase?: string;
        latestProverAttestedHeight?: number;
        proof?: AttestcoinProofData;
        precompileVerified?: boolean;
        lastError?: { message: string };
      };
      if (!response.ok && state.phase === 'FAILED') {
        throw new Error(state.lastError?.message ?? 'Proof worker rejected this transaction');
      }
      updateRun({
        attestationPhase: state.phase ?? 'UNKNOWN',
        ...(state.latestProverAttestedHeight !== undefined
          ? { latestAttestedHeight: state.latestProverAttestedHeight }
          : {}),
        ...(state.proof && state.precompileVerified ? { proof: state.proof } : {}),
      });
    });
  }

  async function settleOnCreditcoin() {
    if (!deployments.verifier || !run.proof) return;
    await withAction('Verifying and settling on Creditcoin…', async () => {
      let hash = run.settlementTransactionHash;
      if (!hash) {
        await switchChainAsync({ chainId: CREDITCOIN_TESTNET_CHAIN_ID });
        hash = await writeContractAsync({
          chainId: CREDITCOIN_TESTNET_CHAIN_ID,
          address: deployments.verifier!,
          abi: attestcoinChargeVerifierAbi,
          functionName: 'verifyAndSettle',
          args: [proofContractArguments(run.proof!)],
        });
        updateRun({ settlementTransactionHash: hash, attestationPhase: 'SUBMITTED' });
      }
      const settled = await waitForTransactionReceipt(wagmiConfig, {
        chainId: CREDITCOIN_TESTNET_CHAIN_ID,
        hash,
      });
      if (settled.status !== 'success') throw new Error('Creditcoin settlement reverted');
      updateRun({
        settlementTransactionHash: hash,
        settlementBlockNumber: Number(settled.blockNumber),
        attestationPhase: 'SETTLED',
      });
      await loadSettlementMetrics().catch(() => undefined);
    });
  }

  async function loadSettlementMetrics() {
    if (!deployments.stationRegistry || !deployments.escrow || !run.receipt) return;
    const station = await readContract(wagmiConfig, {
      chainId: CREDITCOIN_TESTNET_CHAIN_ID,
      address: deployments.stationRegistry,
      abi: stationRegistryAbi,
      functionName: 'station',
      args: [DEMO_STATION_ID],
    });
    const [operatorClaimable, driverClaimable] = await Promise.all([
      readContract(wagmiConfig, {
        chainId: CREDITCOIN_TESTNET_CHAIN_ID,
        address: deployments.escrow,
        abi: chargeIntentEscrowAbi,
        functionName: 'claimable',
        args: [station.payout],
      }),
      readContract(wagmiConfig, {
        chainId: CREDITCOIN_TESTNET_CHAIN_ID,
        address: deployments.escrow,
        abi: chargeIntentEscrowAbi,
        functionName: 'claimable',
        args: [run.receipt.driver],
      }),
    ]);
    updateRun({
      stationPayout: station.payout,
      stationCompletedSessions: station.completedSessions.toString(),
      stationSuccessfulSettlements: station.successfulSettlements.toString(),
      stationTotalEnergyWh: station.totalEnergyWh.toString(),
      stationTotalValueSettled: station.totalValueSettled.toString(),
      operatorClaimable: operatorClaimable.toString(),
      driverClaimable: driverClaimable.toString(),
    });
  }

  function resetRun() {
    window.localStorage.removeItem(STORAGE_KEY);
    setRun({});
    setEnergyWh(0n);
    setCharging(false);
    setLocalPreview(false);
    setAction({ label: 'Ready' });
  }

  const timeline = useMemo(
    () => [
      {
        number: '01',
        label: 'Escrow intent',
        status: run.intentBlockNumber
          ? 'confirmed'
          : run.intentTransactionHash
            ? 'pending'
            : localPreview
              ? 'local preview'
              : 'ready',
      },
      {
        number: '02',
        label: 'Device receipt',
        status: run.deviceSignature
          ? 'signed'
          : energyWh === DEMO_TARGET_ENERGY_WH
            ? 'metered'
            : charging
              ? 'charging'
              : 'waiting',
      },
      {
        number: '03',
        label: 'Sepolia anchor',
        status: run.sourceTransactionHash ? (run.sourceBlockNumber ? 'mined' : 'pending') : 'waiting',
      },
      {
        number: '04',
        label: 'Attestation',
        status: run.attestationPhase ?? 'waiting',
      },
      { number: '05', label: 'Proof', status: run.proof ? 'precompile verified' : 'waiting' },
      {
        number: '06',
        label: 'Settlement',
        status: run.settlementBlockNumber ? 'settled' : run.settlementTransactionHash ? 'pending' : 'waiting',
      },
    ],
    [charging, energyWh, localPreview, run],
  );

  return (
    <main>
      <div className="ambient ambient-one" />
      <div className="ambient ambient-two" />
      <header className="topbar shell">
        <a className="brand" href="#top" aria-label="ChargeProof home">
          <span className="brand-mark" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>
            CHARGE<span>PROOF</span>
          </span>
        </a>
        <div className="topbar-actions">
          <span className={`mode-pill ${liveMode ? 'live' : 'local'}`}>
            <span className="status-dot" /> {liveMode ? 'LIVE TESTNET' : 'LOCAL SIMULATION'}
          </span>
          {account.isConnected ? (
            <button className="wallet-button" onClick={() => disconnect()}>
              {shortAddress(account.address)} <span>Disconnect</span>
            </button>
          ) : (
            <button
              className="wallet-button"
              disabled={connecting || !connectors[0]}
              onClick={() => connectors[0] && connect({ connector: connectors[0] })}
            >
              {connecting ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
        </div>
      </header>

      <section className="hero shell" id="top">
        <div className="eyebrow">
          <span /> METERED INFRASTRUCTURE / TRUSTLESS SETTLEMENT
        </div>
        <div className="hero-grid">
          <div>
            <h1>
              Energy delivered.
              <br />
              <em>Proof settled.</em>
            </h1>
            <p className="hero-copy">
              A charging operator gets paid only when an Attestcoin-verified Sepolia receipt matches the
              driver&apos;s Creditcoin escrow.
            </p>
          </div>
          <div className="route-map" aria-label="Cross-chain route">
            <NetworkNode code="CTC" name="Creditcoin Testnet" detail="Escrow + settlement" active />
            <div className="route-line">
              <span>ATTESTCOIN</span>
              <i />
              <i />
              <i />
            </div>
            <NetworkNode code="SEP" name="Ethereum Sepolia" detail="Charging receipt" />
          </div>
        </div>
        {!liveMode && (
          <div className="truth-banner">
            <strong>Local simulation</strong>
            <span>
              No ChargeProof contracts or transactions are represented as deployed. Configure public
              deployment addresses to unlock live actions.
            </span>
          </div>
        )}
      </section>

      <section className="workflow shell" aria-label="ChargeProof workflow">
        <div className="section-heading">
          <div>
            <span className="kicker">LIVE CONTROL PLANE</span>
            <h2>One intent. Two chains. One proof.</h2>
          </div>
          <div className={`action-state ${action.error ? 'error' : ''}`}>
            <span className="pulse" />
            <div>
              <b>{action.label}</b>
              {action.error && <small>{action.error}</small>}
            </div>
          </div>
        </div>

        <div className="timeline" role="list">
          {timeline.map((step) => (
            <div className={`timeline-step status-${slug(step.status)}`} role="listitem" key={step.number}>
              <span className="step-number">{step.number}</span>
              <div>
                <b>{step.label}</b>
                <small>{step.status.replaceAll('_', ' ')}</small>
              </div>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          <article className="panel intent-panel">
            <PanelHeader index="A" title="Charging intent" badge="CREDITCOIN" />
            <div className="intent-summary">
              <DataRow label="Station" value="CP-SGN-001 · Saigon Grid Node" />
              <DataRow label="Maximum escrow" value="5.00 cpUSDC" mono />
              <DataRow label="Tariff" value="$0.35 / kWh" mono />
              <DataRow label="Source binding" value="Sepolia · key 1" mono />
              <DataRow label="Canonical registry" value={shortAddress(deployments.sepoliaRegistry)} mono />
            </div>
            <div className="button-stack">
              <button
                className="button secondary"
                disabled={!liveMode || !account.isConnected || Boolean(run.intentBlockNumber)}
                onClick={() => void requestFaucet()}
              >
                1 · Mint demo cpUSDC
              </button>
              <button
                className="button primary"
                disabled={!liveMode || !account.isConnected || Boolean(run.intentBlockNumber)}
                onClick={() => void openIntent()}
              >
                {run.intentTransactionHash ? '2 · Resume intent receipt' : '2 · Approve & fund intent'}{' '}
                <Arrow />
              </button>
            </div>
            {run.intentTransactionHash && (
              <ExplorerLink
                network="creditcoin-testnet"
                hash={run.intentTransactionHash}
                label="Escrow transaction"
              />
            )}
          </article>

          <article className="panel charger-panel">
            <PanelHeader index="B" title="Virtual charger" badge="HARDWARE SIMULATOR" accent />
            <div className="device-line">
              <span className={charging ? 'device-online' : ''} /> DEVICE / CP-EMU-01{' '}
              <b>{charging ? 'DELIVERING' : 'STANDBY'}</b>
            </div>
            <div className="energy-reading">
              <strong>{formatEnergy(energyWh)}</strong>
              <span>kWh</span>
            </div>
            <div className="meter">
              <i style={{ width: `${completion}%` }} />
              <span style={{ left: `${completion}%` }} />
            </div>
            <div className="meter-labels">
              <span>0</span>
              <span>{completion}% delivered</span>
              <span>4.20 kWh</span>
            </div>
            <div className="charger-stats">
              <Stat label="Duration" value={charging ? '00:12:40 ×' : energyWh ? '00:15:00' : '00:00:00'} />
              <Stat label="Metered amount" value={`${formatUnits(finalAmount, 6)} cpUSDC`} />
              <Stat
                label="Device trust"
                value={run.deviceSigner ? shortAddress(run.deviceSigner) : 'server-side EIP-712'}
              />
            </div>
            <div className="button-row">
              <button
                className="button primary"
                disabled={charging || (liveMode && !run.intentBlockNumber)}
                onClick={startCharger}
              >
                {energyWh ? 'Restart simulation' : 'Start charging'} <Bolt />
              </button>
              <button
                className="button secondary"
                disabled={!liveMode || energyWh !== DEMO_TARGET_ENERGY_WH || !account.address}
                onClick={() => void sealReceipt()}
              >
                Seal receipt
              </button>
            </div>
            <p className="disclosure">
              Hackathon hardware simulator. Device signatures represent the MVP physical trust boundary; no
              real charger is connected.
            </p>
          </article>

          <article className="panel proof-panel">
            <PanelHeader index="C" title="Cross-chain proof" badge="ATTESTCOIN" />
            <div className="proof-actions">
              <button
                className="button primary"
                disabled={!run.deviceSignature || Boolean(run.sourceBlockNumber)}
                onClick={() => void anchorOnSepolia()}
              >
                {run.sourceTransactionHash ? 'Resume Sepolia receipt' : 'Anchor on Sepolia'} <Arrow />
              </button>
              <button
                className="button secondary"
                disabled={!run.sourceTransactionHash || Boolean(run.proof)}
                onClick={() => void refreshAttestation()}
              >
                Refresh attestation
              </button>
              <button
                className="button lime"
                disabled={!run.proof || Boolean(run.settlementBlockNumber)}
                onClick={() => void settleOnCreditcoin()}
              >
                {run.settlementTransactionHash ? 'Resume settlement receipt' : 'Verify & settle'}
              </button>
            </div>
            <div className="proof-visual">
              <ProofCell
                label="SOURCE"
                value={run.sourceBlockNumber ? `#${run.sourceBlockNumber}` : 'awaiting tx'}
                state={run.sourceBlockNumber ? 'done' : 'idle'}
              />
              <div className="proof-link">
                <i />
                <span>INCLUSION</span>
              </div>
              <ProofCell
                label="ATTESTED HEIGHT"
                value={run.latestAttestedHeight ? `#${run.latestAttestedHeight}` : 'not queried'}
                state={run.proof ? 'done' : 'idle'}
              />
              <div className="proof-link">
                <i />
                <span>CONTINUITY</span>
              </div>
              <ProofCell
                label="0x0FD2"
                value={run.proof ? 'verified' : 'pending'}
                state={run.proof ? 'done' : 'idle'}
              />
            </div>
            {run.sourceTransactionHash && (
              <ExplorerLink network="sepolia" hash={run.sourceTransactionHash} label="Source transaction" />
            )}
            {run.settlementTransactionHash && (
              <ExplorerLink
                network="creditcoin-testnet"
                hash={run.settlementTransactionHash}
                label="Settlement transaction"
              />
            )}
          </article>
        </div>
      </section>

      <section className="evidence shell">
        <article className="panel receipt-viewer">
          <PanelHeader
            index="D"
            title="Decoded receipt"
            badge={run.receipt ? 'DETERMINISTIC' : 'AWAITING METER'}
          />
          <pre>{run.receipt ? JSON.stringify(run.receipt, null, 2) : receiptPlaceholder()}</pre>
          {run.receiptDigest && <CopyField label="EIP-712 digest" value={run.receiptDigest} />}
        </article>
        <article className="panel metadata-viewer">
          <PanelHeader index="E" title="Proof metadata" badge={run.proof ? 'REAL PROOF' : 'NO PROOF YET'} />
          {run.proof ? (
            <div className="metadata-grid">
              <Stat label="Chain key" value={String(run.proof.chainKey)} />
              <Stat label="Tx index" value={String(run.proof.txIndex)} />
              <Stat label="Encoded bytes" value={String((run.proof.txBytes.length - 2) / 2)} />
              <Stat label="Merkle siblings" value={String(run.proof.merkleProof.siblings.length)} />
              <Stat label="Continuity roots" value={String(run.proof.continuityProof.roots.length)} />
              <Stat label="Proof cache" value={run.proof.cached ? 'hit' : 'generated'} />
            </div>
          ) : (
            <div className="empty-state">
              <span>∿</span>
              <p>
                Proof bytes appear only after the source block and block N+1 are available in the Attestcoin
                prover cache.
              </p>
            </div>
          )}
          {run.settlementBlockNumber && run.receipt && (
            <div className="settlement-summary">
              <div className="settlement-title">
                <div>
                  <span>FINAL SETTLEMENT</span>
                  <b>Creditcoin block #{run.settlementBlockNumber}</b>
                </div>
                <button className="text-button" onClick={() => void loadSettlementMetrics()}>
                  Refresh metrics
                </button>
              </div>
              <div className="metadata-grid">
                <Stat label="This station payment" value={`${formatToken(run.receipt.finalAmount)} cpUSDC`} />
                <Stat
                  label="This driver refund"
                  value={`${formatToken((DEMO_MAX_PAYMENT - BigInt(run.receipt.finalAmount)).toString())} cpUSDC`}
                />
                <Stat label="Operator claimable" value={formatOptionalToken(run.operatorClaimable)} />
                <Stat label="Driver claimable" value={formatOptionalToken(run.driverClaimable)} />
                <Stat label="Completed sessions" value={run.stationCompletedSessions ?? 'refresh required'} />
                <Stat
                  label="Successful settlements"
                  value={run.stationSuccessfulSettlements ?? 'refresh required'}
                />
                <Stat
                  label="Total station energy"
                  value={
                    run.stationTotalEnergyWh
                      ? `${formatEnergy(BigInt(run.stationTotalEnergyWh))} kWh`
                      : 'refresh required'
                  }
                />
                <Stat label="Total value settled" value={formatOptionalToken(run.stationTotalValueSettled)} />
              </div>
              <p className="disclosure">
                Payout {shortAddress(run.stationPayout)} · claimable balances are live contract reads, not
                transfer simulations.
              </p>
            </div>
          )}
          <div className="protocol-spike">
            <span>VERIFIED PROTOCOL SPIKE</span>
            <p>Official example scaffolding · not a ChargeProof settlement</p>
            <a
              href={explorerTransactionUrl(
                'sepolia',
                '0xce785c35e300d607d83da9564990c4d2aaf45dafc68ef76539d97aee3de6859b',
              )}
              target="_blank"
              rel="noreferrer"
            >
              Sepolia source ↗
            </a>
            <a
              href={explorerTransactionUrl(
                'creditcoin-testnet',
                '0x7cc3a7333e9522f5921e6430bd59192caf7e1ce2382ae022879da93cd4ae9388',
              )}
              target="_blank"
              rel="noreferrer"
            >
              Creditcoin verify ↗
            </a>
          </div>
        </article>
      </section>

      <section className="trust shell">
        <div>
          <span className="kicker">SECURITY BOUNDARY</span>
          <h2>
            Attestation is necessary.
            <br />
            It is not magic.
          </h2>
        </div>
        <div className="trust-grid">
          <TrustItem
            number="01"
            title="Attestcoin proves"
            copy="Transaction inclusion and continuity to a finalized, attested Sepolia history."
          />
          <TrustItem
            number="02"
            title="ChargeProof verifies"
            copy="Receipt status, source chain, canonical target, sender, selector, calldata, signer, amount, expiry, and replay keys."
          />
          <TrustItem
            number="03"
            title="The device represents"
            copy="Physical delivery authenticity for this MVP. Secure elements and OCPP integration are production roadmap work."
          />
        </div>
      </section>

      <footer className="footer shell">
        <div>
          <b>
            CHARGE<span>PROOF</span>
          </b>
          <small>BUIDL CTC 2026 FALL · DePIN</small>
        </div>
        <button className="text-button" onClick={resetRun}>
          Reset local run
        </button>
        <span className="footer-mark">POWERED BY ATTESTCOIN / CREDITCOIN</span>
      </footer>
    </main>
  );
}

function toContractReceipt(receipt: StoredReceipt) {
  return {
    ...receipt,
    startedAt: BigInt(receipt.startedAt),
    endedAt: BigInt(receipt.endedAt),
    energyWh: BigInt(receipt.energyWh),
    tariff: BigInt(receipt.tariff),
    finalAmount: BigInt(receipt.finalAmount),
    nonce: BigInt(receipt.nonce),
  };
}

function NetworkNode({
  code,
  name,
  detail,
  active = false,
}: {
  code: string;
  name: string;
  detail: string;
  active?: boolean;
}) {
  return (
    <div className={`network-node ${active ? 'active' : ''}`}>
      <span>{code}</span>
      <div>
        <b>{name}</b>
        <small>{detail}</small>
      </div>
    </div>
  );
}

function PanelHeader({
  index,
  title,
  badge,
  accent = false,
}: {
  index: string;
  title: string;
  badge: string;
  accent?: boolean;
}) {
  return (
    <header className="panel-header">
      <span className={accent ? 'accent' : ''}>{index}</span>
      <h3>{title}</h3>
      <small>{badge}</small>
    </header>
  );
}

function DataRow({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="data-row">
      <span>{label}</span>
      <b className={mono ? 'mono' : ''}>{value}</b>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <b>{value}</b>
    </div>
  );
}

function ProofCell({ label, value, state }: { label: string; value: string; state: 'done' | 'idle' }) {
  return (
    <div className={`proof-cell ${state}`}>
      <span>{label}</span>
      <b>{value}</b>
      <i />
    </div>
  );
}

function TrustItem({ number, title, copy }: { number: string; title: string; copy: string }) {
  return (
    <article className="trust-item">
      <span>{number}</span>
      <h3>{title}</h3>
      <p>{copy}</p>
    </article>
  );
}

function ExplorerLink({
  network,
  hash,
  label,
}: {
  network: 'sepolia' | 'creditcoin-testnet';
  hash: Hex;
  label: string;
}) {
  return (
    <a
      className="explorer-link"
      href={explorerTransactionUrl(network, hash)}
      target="_blank"
      rel="noreferrer"
    >
      <span>{label}</span>
      <code>{shortHash(hash)}</code>
      <b>↗</b>
    </a>
  );
}

function CopyField({ label, value }: { label: string; value: string }) {
  return (
    <button className="copy-field" onClick={() => void navigator.clipboard.writeText(value)}>
      <span>{label}</span>
      <code>{shortHash(value)}</code>
      <b>Copy</b>
    </button>
  );
}

function Arrow() {
  return <span aria-hidden="true">→</span>;
}
function Bolt() {
  return <span aria-hidden="true">ϟ</span>;
}
function formatEnergy(wh: bigint) {
  return (Number(wh) / 1_000).toFixed(2);
}
function formatToken(value: string) {
  return formatUnits(BigInt(value), 6);
}
function formatOptionalToken(value?: string) {
  return value ? `${formatToken(value)} cpUSDC` : 'refresh required';
}
function shortAddress(value?: string) {
  return value ? `${value.slice(0, 6)}…${value.slice(-4)}` : 'Not deployed';
}
function shortHash(value: string) {
  return `${value.slice(0, 10)}…${value.slice(-8)}`;
}
function slug(value: string) {
  return value.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-');
}
function compactError(value: string) {
  return value.length > 180 ? `${value.slice(0, 177)}…` : value;
}
function receiptPlaceholder() {
  return JSON.stringify(
    {
      intentId: 'awaiting intent',
      sessionId: 'derived after metering',
      stationId: 'CP-SGN-001',
      energyWh: 0,
      finalAmount: '0 cpUSDC',
      signature: 'server-side only',
    },
    null,
    2,
  );
}
