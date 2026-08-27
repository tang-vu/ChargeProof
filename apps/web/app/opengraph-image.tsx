import { ImageResponse } from 'next/og';

export const alt = 'ChargeProof — trustless cross-chain EV charging settlement';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpenGraphImage() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: '64px 72px',
        color: '#ecf7f5',
        background: 'linear-gradient(135deg, #05090d 0%, #07151b 62%, #0c1c1e 100%)',
        fontFamily: 'Arial, sans-serif',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              display: 'flex',
              width: 42,
              height: 42,
              background: '#42e9f5',
              boxShadow: 'inset 0 -14px #c8ff45',
              transform: 'skewX(-11deg)',
            }}
          />
          <div style={{ display: 'flex', fontSize: 24, fontWeight: 700, letterSpacing: 5 }}>
            CHARGE<span style={{ color: '#42e9f5' }}>PROOF</span>
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            color: '#c8ff45',
            border: '1px solid #405524',
            padding: '13px 18px',
            fontSize: 15,
            letterSpacing: 2,
          }}
        >
          ● LIVE TESTNET
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        <div style={{ color: '#42e9f5', fontSize: 17, letterSpacing: 4, marginBottom: 22 }}>
          METERED INFRASTRUCTURE / TRUSTLESS SETTLEMENT
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            fontSize: 76,
            fontWeight: 700,
            lineHeight: 0.98,
          }}
        >
          <span>Energy delivered.</span>
          <span style={{ color: '#42e9f5' }}>Proof settled.</span>
        </div>
        <div style={{ color: '#a6b7ba', fontSize: 24, marginTop: 28 }}>
          Sepolia receipt → Attestcoin proof → Creditcoin escrow
        </div>
      </div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: 22,
          borderTop: '1px solid #28414d',
          color: '#82949a',
          fontSize: 17,
          letterSpacing: 2,
        }}
      >
        <span>BUIDL CTC 2026 FALL · DePIN</span>
        <span style={{ color: '#c8ff45' }}>SETTLED + REPLAY REJECTED</span>
      </div>
    </div>,
    size,
  );
}
