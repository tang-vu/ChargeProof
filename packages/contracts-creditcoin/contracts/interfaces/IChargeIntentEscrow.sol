// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

interface IChargeIntentEscrow {
    struct IntentSnapshot {
        address driver;
        bytes32 stationId;
        address stationPayout;
        address deviceSigner;
        uint256 maxPayment;
        uint256 tariff;
        uint64 openedAt;
        uint64 expiresAt;
        uint64 sourceChainKey;
        address sourceRegistry;
        uint8 state;
    }

    struct VerifiedSettlement {
        bytes32 intentId;
        bytes32 sessionId;
        bytes32 sourceTransactionKey;
        bytes32 stationId;
        address driver;
        uint64 endedAt;
        uint64 energyWh;
        uint256 tariff;
        uint256 finalAmount;
    }

    function intentSnapshot(bytes32 intentId) external view returns (IntentSnapshot memory);

    function settleVerified(VerifiedSettlement calldata settlement) external;
}
