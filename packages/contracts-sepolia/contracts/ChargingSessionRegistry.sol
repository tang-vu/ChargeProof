// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";

/// @title ChargingSessionRegistry
/// @notice Canonical Sepolia anchor for ChargeProof device-signed charging receipts.
/// @dev This non-upgradeable contract validates the physical-device trust boundary represented by an
/// authorized EIP-712 signer. Attestcoin later proves the successful transaction to Creditcoin.
contract ChargingSessionRegistry is EIP712, Ownable2Step {
    string public constant EIP712_NAME = "ChargeProof Device Receipt";
    string public constant EIP712_VERSION = "1";
    uint64 public constant MAX_SESSION_DURATION = 24 hours;
    uint64 public constant MAX_CLOCK_SKEW = 5 minutes;

    bytes32 public constant RECEIPT_TYPEHASH = keccak256(
        "ChargingReceipt(bytes32 intentId,bytes32 sessionId,bytes32 stationId,address driver,uint64 startedAt,uint64 endedAt,uint64 energyWh,uint256 tariff,uint256 finalAmount,uint64 nonce)"
    );

    struct ChargingReceipt {
        bytes32 intentId;
        bytes32 sessionId;
        bytes32 stationId;
        address driver;
        uint64 startedAt;
        uint64 endedAt;
        uint64 energyWh;
        uint256 tariff;
        uint256 finalAmount;
        uint64 nonce;
    }

    struct StationDevice {
        address signer;
        bool active;
        string metadataURI;
    }

    mapping(bytes32 stationId => StationDevice device) private _stations;
    mapping(bytes32 sessionId => bool finalized) public finalizedSessions;
    mapping(bytes32 stationId => mapping(uint64 nonce => bool used)) public usedDeviceNonces;

    error ClockSkewExceeded(uint64 endedAt, uint256 currentTime);
    error DuplicateDeviceNonce(bytes32 stationId, uint64 nonce);
    error DuplicateSession(bytes32 sessionId);
    error EmptyIdentifier();
    error InactiveStation(bytes32 stationId);
    error InvalidAmount(uint256 supplied, uint256 expected);
    error InvalidDeviceSignature(address recovered, address expected);
    error InvalidDriver(address caller, address receiptDriver);
    error InvalidEnergy();
    error InvalidSessionId(bytes32 supplied, bytes32 expected);
    error InvalidSessionWindow(uint64 startedAt, uint64 endedAt);
    error InvalidSigner();

    event StationDeviceConfigured(
        bytes32 indexed stationId,
        address indexed signer,
        bool active,
        string metadataURI
    );
    event SessionFinalized(
        bytes32 indexed intentId,
        bytes32 indexed sessionId,
        bytes32 indexed stationId,
        address driver,
        uint64 startedAt,
        uint64 endedAt,
        uint64 energyWh,
        uint256 tariff,
        uint256 finalAmount,
        uint64 nonce,
        bytes32 receiptDigest
    );

    constructor(address initialOwner) EIP712(EIP712_NAME, EIP712_VERSION) Ownable(initialOwner) {}

    function configureStation(
        bytes32 stationId,
        address signer,
        bool active,
        string calldata metadataURI
    ) external onlyOwner {
        if (stationId == bytes32(0)) revert EmptyIdentifier();
        if (signer == address(0)) revert InvalidSigner();

        _stations[stationId] = StationDevice({signer: signer, active: active, metadataURI: metadataURI});
        emit StationDeviceConfigured(stationId, signer, active, metadataURI);
    }

    function station(bytes32 stationId) external view returns (StationDevice memory) {
        return _stations[stationId];
    }

    function expectedSessionId(ChargingReceipt calldata receipt) public pure returns (bytes32) {
        return keccak256(
            abi.encode(receipt.intentId, receipt.stationId, receipt.driver, receipt.startedAt, receipt.nonce)
        );
    }

    function expectedAmount(uint64 energyWh, uint256 tariff) public pure returns (uint256) {
        return Math.mulDiv(uint256(energyWh), tariff, 1_000, Math.Rounding.Ceil);
    }

    function receiptDigest(ChargingReceipt calldata receipt) public view returns (bytes32) {
        return _hashTypedDataV4(_receiptStructHash(receipt));
    }

    /// @notice Finalize one session. The caller must be the driver named by the device-signed receipt.
    function finalizeSession(
        ChargingReceipt calldata receipt,
        bytes calldata deviceSignature
    ) external returns (bytes32 digest) {
        if (receipt.intentId == bytes32(0) || receipt.stationId == bytes32(0)) revert EmptyIdentifier();
        if (msg.sender != receipt.driver) revert InvalidDriver(msg.sender, receipt.driver);

        StationDevice storage device = _stations[receipt.stationId];
        if (!device.active) revert InactiveStation(receipt.stationId);

        if (
            receipt.endedAt < receipt.startedAt ||
            receipt.endedAt - receipt.startedAt > MAX_SESSION_DURATION
        ) {
            revert InvalidSessionWindow(receipt.startedAt, receipt.endedAt);
        }
        if (receipt.endedAt > block.timestamp + MAX_CLOCK_SKEW) {
            revert ClockSkewExceeded(receipt.endedAt, block.timestamp);
        }
        if (receipt.energyWh == 0) revert InvalidEnergy();

        bytes32 calculatedSessionId = expectedSessionId(receipt);
        if (receipt.sessionId != calculatedSessionId) {
            revert InvalidSessionId(receipt.sessionId, calculatedSessionId);
        }
        if (finalizedSessions[receipt.sessionId]) revert DuplicateSession(receipt.sessionId);
        if (usedDeviceNonces[receipt.stationId][receipt.nonce]) {
            revert DuplicateDeviceNonce(receipt.stationId, receipt.nonce);
        }

        uint256 calculatedAmount = expectedAmount(receipt.energyWh, receipt.tariff);
        if (receipt.finalAmount != calculatedAmount) {
            revert InvalidAmount(receipt.finalAmount, calculatedAmount);
        }

        digest = _hashTypedDataV4(_receiptStructHash(receipt));
        (address recovered, ECDSA.RecoverError recoverError,) = ECDSA.tryRecover(digest, deviceSignature);
        if (recoverError != ECDSA.RecoverError.NoError || recovered != device.signer) {
            revert InvalidDeviceSignature(recovered, device.signer);
        }

        finalizedSessions[receipt.sessionId] = true;
        usedDeviceNonces[receipt.stationId][receipt.nonce] = true;

        emit SessionFinalized(
            receipt.intentId,
            receipt.sessionId,
            receipt.stationId,
            receipt.driver,
            receipt.startedAt,
            receipt.endedAt,
            receipt.energyWh,
            receipt.tariff,
            receipt.finalAmount,
            receipt.nonce,
            digest
        );
    }

    function _receiptStructHash(ChargingReceipt calldata receipt) private pure returns (bytes32) {
        return keccak256(
            abi.encode(
                RECEIPT_TYPEHASH,
                receipt.intentId,
                receipt.sessionId,
                receipt.stationId,
                receipt.driver,
                receipt.startedAt,
                receipt.endedAt,
                receipt.energyWh,
                receipt.tariff,
                receipt.finalAmount,
                receipt.nonce
            )
        );
    }
}
