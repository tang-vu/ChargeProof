// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Ownable2Step} from "@openzeppelin/contracts/access/Ownable2Step.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import {IChargeIntentEscrow} from "./interfaces/IChargeIntentEscrow.sol";
import {StationRegistry} from "./StationRegistry.sol";

/// @title ChargeIntentEscrow
/// @notice Holds a driver's maximum payment until an Attestcoin-verified charging receipt settles it.
contract ChargeIntentEscrow is IChargeIntentEscrow, Ownable2Step, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint64 public constant MIN_INTENT_LIFETIME = 10 minutes;
    uint64 public constant MAX_INTENT_LIFETIME = 30 days;
    uint64 public constant ATTESTATION_GRACE_PERIOD = 30 minutes;

    enum IntentState {
        None,
        Open,
        Settled,
        Refunded
    }

    struct Intent {
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
        IntentState state;
        uint256 paidAmount;
        uint256 refundAmount;
        bytes32 sourceTransactionKey;
        bytes32 sessionId;
    }

    IERC20 public immutable paymentToken;
    StationRegistry public immutable stationRegistry;
    address public verifier;
    uint256 public totalEscrowed;
    uint256 public totalClaimable;

    mapping(bytes32 intentId => Intent intent) private _intents;
    mapping(address account => uint256 value) public claimable;

    error AmountAboveEscrow(uint256 amount, uint256 maximum);
    error EmptyIntentId();
    error IncorrectDriver(address supplied, address expected);
    error IncorrectStation(bytes32 supplied, bytes32 expected);
    error IncorrectTariff(uint256 supplied, uint256 expected);
    error IntentAlreadyExists(bytes32 intentId);
    error IntentNotOpen(bytes32 intentId, IntentState state);
    error InvalidAmount();
    error InvalidExpiry(uint64 expiry);
    error InvalidNetworkBinding();
    error NoClaim();
    error NotDriver(address caller);
    error NotVerifier(address caller);
    error SessionEndedAfterExpiry(uint64 endedAt, uint64 expiresAt);
    error TooEarlyToRefund(uint64 refundableAt);
    error VerifierAlreadySet();

    event ClaimWithdrawn(address indexed account, address indexed recipient, uint256 amount);
    event IntentOpened(
        bytes32 indexed intentId,
        address indexed driver,
        bytes32 indexed stationId,
        address stationPayout,
        uint256 maxPayment,
        uint256 tariff,
        uint64 openedAt,
        uint64 expiresAt,
        uint64 sourceChainKey,
        address sourceRegistry
    );
    event IntentRefunded(bytes32 indexed intentId, address indexed driver, uint256 amount);
    event IntentSettled(
        bytes32 indexed intentId,
        bytes32 indexed sessionId,
        bytes32 indexed sourceTransactionKey,
        address stationPayout,
        uint256 stationPayment,
        uint256 driverRefund,
        uint64 energyWh
    );
    event VerifierSet(address indexed verifier);

    constructor(
        address initialOwner,
        IERC20 paymentToken_,
        StationRegistry stationRegistry_
    ) Ownable(initialOwner) {
        if (address(paymentToken_) == address(0) || address(stationRegistry_) == address(0)) {
            revert InvalidNetworkBinding();
        }
        paymentToken = paymentToken_;
        stationRegistry = stationRegistry_;
    }

    function setVerifier(address verifier_) external onlyOwner {
        if (verifier != address(0)) revert VerifierAlreadySet();
        if (verifier_ == address(0)) revert InvalidNetworkBinding();
        verifier = verifier_;
        emit VerifierSet(verifier_);
    }

    function openIntent(
        bytes32 intentId,
        bytes32 stationId,
        uint256 maxPayment,
        uint256 tariff,
        uint64 expiresAt,
        uint64 sourceChainKey,
        address sourceRegistry
    ) external nonReentrant {
        if (intentId == bytes32(0)) revert EmptyIntentId();
        if (_intents[intentId].state != IntentState.None) revert IntentAlreadyExists(intentId);
        if (maxPayment == 0 || tariff == 0) revert InvalidAmount();
        if (
            expiresAt < block.timestamp + MIN_INTENT_LIFETIME ||
            expiresAt > block.timestamp + MAX_INTENT_LIFETIME
        ) revert InvalidExpiry(expiresAt);
        if (sourceChainKey == 0 || sourceRegistry == address(0)) revert InvalidNetworkBinding();

        (address payout, address deviceSigner) = stationRegistry.requireActiveStation(stationId);

        _intents[intentId] = Intent({
            driver: msg.sender,
            stationId: stationId,
            stationPayout: payout,
            deviceSigner: deviceSigner,
            maxPayment: maxPayment,
            tariff: tariff,
            openedAt: uint64(block.timestamp),
            expiresAt: expiresAt,
            sourceChainKey: sourceChainKey,
            sourceRegistry: sourceRegistry,
            state: IntentState.Open,
            paidAmount: 0,
            refundAmount: 0,
            sourceTransactionKey: bytes32(0),
            sessionId: bytes32(0)
        });
        totalEscrowed += maxPayment;
        paymentToken.safeTransferFrom(msg.sender, address(this), maxPayment);

        emit IntentOpened(
            intentId,
            msg.sender,
            stationId,
            payout,
            maxPayment,
            tariff,
            uint64(block.timestamp),
            expiresAt,
            sourceChainKey,
            sourceRegistry
        );
    }

    function settleVerified(VerifiedSettlement calldata settlement) external nonReentrant {
        if (msg.sender != verifier) revert NotVerifier(msg.sender);
        Intent storage storedIntent = _intents[settlement.intentId];
        if (storedIntent.state != IntentState.Open) {
            revert IntentNotOpen(settlement.intentId, storedIntent.state);
        }
        if (settlement.driver != storedIntent.driver) {
            revert IncorrectDriver(settlement.driver, storedIntent.driver);
        }
        if (settlement.stationId != storedIntent.stationId) {
            revert IncorrectStation(settlement.stationId, storedIntent.stationId);
        }
        if (settlement.tariff != storedIntent.tariff) {
            revert IncorrectTariff(settlement.tariff, storedIntent.tariff);
        }
        if (settlement.finalAmount > storedIntent.maxPayment) {
            revert AmountAboveEscrow(settlement.finalAmount, storedIntent.maxPayment);
        }
        if (settlement.endedAt > storedIntent.expiresAt) {
            revert SessionEndedAfterExpiry(settlement.endedAt, storedIntent.expiresAt);
        }

        uint256 refund = storedIntent.maxPayment - settlement.finalAmount;
        storedIntent.state = IntentState.Settled;
        storedIntent.paidAmount = settlement.finalAmount;
        storedIntent.refundAmount = refund;
        storedIntent.sourceTransactionKey = settlement.sourceTransactionKey;
        storedIntent.sessionId = settlement.sessionId;

        totalEscrowed -= storedIntent.maxPayment;
        totalClaimable += storedIntent.maxPayment;
        claimable[storedIntent.stationPayout] += settlement.finalAmount;
        claimable[storedIntent.driver] += refund;

        stationRegistry.recordSettlement(
            storedIntent.stationId,
            settlement.sessionId,
            settlement.energyWh,
            settlement.finalAmount
        );

        emit IntentSettled(
            settlement.intentId,
            settlement.sessionId,
            settlement.sourceTransactionKey,
            storedIntent.stationPayout,
            settlement.finalAmount,
            refund,
            settlement.energyWh
        );
    }

    function refundExpired(bytes32 intentId) external nonReentrant {
        Intent storage storedIntent = _intents[intentId];
        if (storedIntent.state != IntentState.Open) revert IntentNotOpen(intentId, storedIntent.state);
        if (msg.sender != storedIntent.driver) revert NotDriver(msg.sender);
        uint64 refundableAt = storedIntent.expiresAt + ATTESTATION_GRACE_PERIOD;
        if (block.timestamp <= refundableAt) revert TooEarlyToRefund(refundableAt);

        storedIntent.state = IntentState.Refunded;
        storedIntent.refundAmount = storedIntent.maxPayment;
        totalEscrowed -= storedIntent.maxPayment;
        totalClaimable += storedIntent.maxPayment;
        claimable[storedIntent.driver] += storedIntent.maxPayment;
        emit IntentRefunded(intentId, storedIntent.driver, storedIntent.maxPayment);
    }

    function withdrawClaim(address recipient) external nonReentrant {
        uint256 value = claimable[msg.sender];
        if (value == 0) revert NoClaim();
        if (recipient == address(0)) revert InvalidNetworkBinding();
        claimable[msg.sender] = 0;
        totalClaimable -= value;
        paymentToken.safeTransfer(recipient, value);
        emit ClaimWithdrawn(msg.sender, recipient, value);
    }

    function intent(bytes32 intentId) external view returns (Intent memory) {
        return _intents[intentId];
    }

    function intentSnapshot(bytes32 intentId) external view returns (IntentSnapshot memory) {
        Intent storage source = _intents[intentId];
        return IntentSnapshot({
            driver: source.driver,
            stationId: source.stationId,
            stationPayout: source.stationPayout,
            deviceSigner: source.deviceSigner,
            maxPayment: source.maxPayment,
            tariff: source.tariff,
            openedAt: source.openedAt,
            expiresAt: source.expiresAt,
            sourceChainKey: source.sourceChainKey,
            sourceRegistry: source.sourceRegistry,
            state: uint8(source.state)
        });
    }
}
