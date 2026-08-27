import type { Metadata, Viewport } from 'next';

import '@fontsource-variable/manrope';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import '@fontsource/ibm-plex-mono/latin-600.css';

import { Providers } from './providers';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL('https://chargeproof-plum.vercel.app'),
  title: 'ChargeProof — Trustless EV charging settlement',
  description: 'Escrow on Creditcoin. Charge on Sepolia. Settle only after Attestcoin verifies the receipt.',
  alternates: { canonical: '/' },
  keywords: ['Creditcoin', 'Attestcoin', 'DePIN', 'EV charging', 'cross-chain settlement'],
  openGraph: {
    type: 'website',
    url: '/',
    siteName: 'ChargeProof',
    title: 'ChargeProof — Energy delivered. Proof settled.',
    description:
      'Project-owned Sepolia receipt, Attestcoin proof, Creditcoin settlement, and rejected replay — publicly verifiable.',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'ChargeProof — Energy delivered. Proof settled.',
    description: 'Trustless cross-chain EV charging settlement powered by Attestcoin.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  colorScheme: 'dark',
  themeColor: '#05090d',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
