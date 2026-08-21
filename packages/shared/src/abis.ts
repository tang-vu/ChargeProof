export const chargingSessionRegistryAbi = [
  {
    type: 'function',
    name: 'finalizeSession',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'receipt',
        type: 'tuple',
        components: [
          { name: 'intentId', type: 'bytes32' },
          { name: 'sessionId', type: 'bytes32' },
          { name: 'stationId', type: 'bytes32' },
          { name: 'driver', type: 'address' },
          { name: 'startedAt', type: 'uint64' },
          { name: 'endedAt', type: 'uint64' },
          { name: 'energyWh', type: 'uint64' },
          { name: 'tariff', type: 'uint256' },
          { name: 'finalAmount', type: 'uint256' },
          { name: 'nonce', type: 'uint64' },
        ],
      },
      { name: 'deviceSignature', type: 'bytes' },
    ],
    outputs: [{ name: 'digest', type: 'bytes32' }],
  },
] as const;

export const chargeIntentEscrowAbi = [
  {
    type: 'function',
    name: 'openIntent',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'intentId', type: 'bytes32' },
      { name: 'stationId', type: 'bytes32' },
      { name: 'maxPayment', type: 'uint256' },
      { name: 'tariff', type: 'uint256' },
      { name: 'expiresAt', type: 'uint64' },
      { name: 'sourceChainKey', type: 'uint64' },
      { name: 'sourceRegistry', type: 'address' },
    ],
    outputs: [],
  },
  {
    type: 'function',
    name: 'withdrawClaim',
    stateMutability: 'nonpayable',
    inputs: [{ name: 'recipient', type: 'address' }],
    outputs: [],
  },
  {
    type: 'function',
    name: 'claimable',
    stateMutability: 'view',
    inputs: [{ name: 'account', type: 'address' }],
    outputs: [{ name: 'value', type: 'uint256' }],
  },
] as const;

export const mockUsdcAbi = [
  {
    type: 'function',
    name: 'faucet',
    stateMutability: 'nonpayable',
    inputs: [],
    outputs: [],
  },
  {
    type: 'function',
    name: 'approve',
    stateMutability: 'nonpayable',
    inputs: [
      { name: 'spender', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
    outputs: [{ name: '', type: 'bool' }],
  },
] as const;

export const stationRegistryAbi = [
  {
    type: 'function',
    name: 'station',
    stateMutability: 'view',
    inputs: [{ name: 'stationId', type: 'bytes32' }],
    outputs: [
      {
        name: 'stationData',
        type: 'tuple',
        components: [
          { name: 'payout', type: 'address' },
          { name: 'deviceSigner', type: 'address' },
          { name: 'active', type: 'bool' },
          { name: 'metadataURI', type: 'string' },
          { name: 'completedSessions', type: 'uint64' },
          { name: 'successfulSettlements', type: 'uint64' },
          { name: 'totalEnergyWh', type: 'uint256' },
          { name: 'totalValueSettled', type: 'uint256' },
        ],
      },
    ],
  },
] as const;

export const attestcoinChargeVerifierAbi = [
  {
    type: 'function',
    name: 'verifyAndSettle',
    stateMutability: 'nonpayable',
    inputs: [
      {
        name: 'proof',
        type: 'tuple',
        components: [
          { name: 'chainKey', type: 'uint64' },
          { name: 'blockHeight', type: 'uint64' },
          { name: 'encodedTransaction', type: 'bytes' },
          { name: 'merkleRoot', type: 'bytes32' },
          {
            name: 'siblings',
            type: 'tuple[]',
            components: [
              { name: 'hash', type: 'bytes32' },
              { name: 'isLeft', type: 'bool' },
            ],
          },
          { name: 'lowerEndpointDigest', type: 'bytes32' },
          { name: 'continuityRoots', type: 'bytes32[]' },
        ],
      },
    ],
    outputs: [{ name: 'settlementKey', type: 'bytes32' }],
  },
] as const;
