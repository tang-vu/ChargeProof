import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  reactStrictMode: true,
  serverExternalPackages: ['@gluwa/usc-sdk', 'ethers'],
  transpilePackages: ['@chargeproof/shared', '@chargeproof/attestation-worker'],
};

export default nextConfig;
