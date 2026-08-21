// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";
import {EvmV1Decoder} from "@gluwa/usc-contracts/contracts/write-ability/common/EvmV1Decoder.sol";
import {INativeQueryVerifier} from "@gluwa/usc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

import {IChargeIntentEscrow} from "./interfaces/IChargeIntentEscrow.sol";

/// @title AttestcoinChargeVerifier
/// @notice Verifies a Sepolia charging transaction through Attestcoin and releases Creditcoin escrow.
contract AttestcoinChargeVerifier {
    uint256 public constant SOURCE_CHAIN_ID = 11_155_111;
    uint64 public constant INTENT_START_CLOCK_SKEW = 5 minutes;
    uint64 public constant MAX_SESSION_DURATION = 24 hours;
    string public constant EIP712_NAME = "ChargeProof Device Receipt";
    string public constant EIP712_VERSION = "1";

    bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256(
        "EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"
    );
    bytes32 public constant RECEIPT_TYPEHASH = keccak256(
        "ChargingReceipt(bytes32 intentId,bytes32 sessionId,bytes32 stationId,address driver,uint64 startedAt,uint64 endedAt,uint64 energyWh,uint256 tariff,uint256 finalAmount,uint64 nonce)"
    );
    bytes4 public constant FINALIZE_SESSION_SELECTOR = bytes4(
        keccak256(
            "finalizeSession((bytes32,bytes32,bytes32,address,uint64,uint64,uint64,uint256,uint256,uint64),bytes)"
        )
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

    struct AttestcoinProof {
        uint64 chainKey;
        uint64 blockHeight;
        bytes encodedTransaction;
        bytes32 merkleRoot;
        INativeQueryVerifier.MerkleProofEntry[] siblings;
        bytes32 lowerEndpointDigest;
        bytes32[] continuityRoots;
    }

    INativeQueryVerifier public immutable blockProver;
    IChargeIntentEscrow public immutable escrow;
    uint64 public immutable expectedSourceChainKey;
    address public immutable expectedSourceRegistry;

    mapping(bytes32 sourceTransactionKey => bool processed) public processedSourceTransactions;
    mapping(bytes32 settlementKey => bool processed) public processedSettlements;
    mapping(bytes32 sessionId => bool processed) public processedSessions;

    error AmountAboveEscrow(uint256 amount, uint256 maximum);
    error EmptyCalldata();
    error InactiveIntent(bytes32 intentId, uint8 state);
    error IncorrectAmount(uint256 supplied, uint256 expected);
    error IncorrectDeviceSigner(address recovered, address expected);
    error IncorrectDriver(address supplied, address expected);
    error IncorrectFunctionSelector(bytes4 supplied, bytes4 expected);
    error IncorrectSourceChain(uint64 supplied, uint64 expected);
    error IncorrectSourceContract(address supplied, address expected);
    error IncorrectStation(bytes32 supplied, bytes32 expected);
    error IncorrectTariff(uint256 supplied, uint256 expected);
    error InvalidEnergy();
    error InvalidProof();
    error InvalidReceiptStatus(uint8 status);
    error InvalidSessionId(bytes32 supplied, bytes32 expected);
    error InvalidSessionWindow(uint64 startedAt, uint64 endedAt);
    error NetworkBindingMismatch();
    error Replay(bytes32 key);
    error SessionStartedBeforeIntent(uint64 startedAt, uint64 openedAt);
    error SessionEndedAfterExpiry(uint64 endedAt, uint64 expiresAt);
    error UnsupportedTransactionType(uint8 transactionType);

    event ChargingProofSettled(
        bytes32 indexed intentId,
        bytes32 indexed sessionId,
        bytes32 indexed sourceTransactionKey,
        bytes32 settlementKey,
        uint64 sourceBlockHeight,
        uint64 sourceTransactionIndex,
        uint256 finalAmount
    );

    constructor(
        IChargeIntentEscrow escrow_,
        INativeQueryVerifier blockProver_,
        uint64 sourceChainKey_,
        address sourceRegistry_
    ) {
        if (
            address(escrow_) == address(0) ||
            address(blockProver_) == address(0) ||
            sourceChainKey_ == 0 ||
            sourceRegistry_ == address(0)
        ) revert NetworkBindingMismatch();
        if (
            block.chainid == 102_031 &&
            address(blockProver_) != 0x0000000000000000000000000000000000000FD2
        ) revert NetworkBindingMismatch();

        escrow = escrow_;
        blockProver = blockProver_;
        expectedSourceChainKey = sourceChainKey_;
        expectedSourceRegistry = sourceRegistry_;
    }

    function verifyAndSettle(AttestcoinProof calldata proof) external returns (bytes32 settlementKey) {
        if (proof.chainKey != expectedSourceChainKey) {
            revert IncorrectSourceChain(proof.chainKey, expectedSourceChainKey);
        }

        INativeQueryVerifier.MerkleProof memory merkleProof = INativeQueryVerifier.MerkleProof({
            root: proof.merkleRoot,
            siblings: proof.siblings
        });
        uint64 transactionIndex = blockProver.calculateTxIndex(merkleProof);
        bytes32 sourceTransactionKey = keccak256(
            abi.encode(proof.chainKey, proof.blockHeight, transactionIndex)
        );
        if (processedSourceTransactions[sourceTransactionKey]) revert Replay(sourceTransactionKey);

        INativeQueryVerifier.ContinuityProof memory continuityProof = INativeQueryVerifier.ContinuityProof({
            lowerEndpointDigest: proof.lowerEndpointDigest,
            roots: proof.continuityRoots
        });
        bool verified = blockProver.verifyAndEmit(
            proof.chainKey,
            proof.blockHeight,
            proof.encodedTransaction,
            merkleProof,
            continuityProof
        );
        if (!verified) revert InvalidProof();

        (ChargingReceipt memory receipt, bytes memory deviceSignature) = _decodeAndValidateTransaction(
            proof.encodedTransaction
        );
        IChargeIntentEscrow.IntentSnapshot memory intent = escrow.intentSnapshot(receipt.intentId);
        _validateReceipt(receipt, deviceSignature, intent);

        settlementKey = keccak256(abi.encode(sourceTransactionKey, receipt.intentId));
        if (processedSettlements[settlementKey]) revert Replay(settlementKey);
        if (processedSessions[receipt.sessionId]) revert Replay(receipt.sessionId);

        processedSourceTransactions[sourceTransactionKey] = true;
        processedSettlements[settlementKey] = true;
        processedSessions[receipt.sessionId] = true;

        escrow.settleVerified(
            IChargeIntentEscrow.VerifiedSettlement({
                intentId: receipt.intentId,
                sessionId: receipt.sessionId,
                sourceTransactionKey: sourceTransactionKey,
                stationId: receipt.stationId,
                driver: receipt.driver,
                endedAt: receipt.endedAt,
                energyWh: receipt.energyWh,
                tariff: receipt.tariff,
                finalAmount: receipt.finalAmount
            })
        );

        emit ChargingProofSettled(
            receipt.intentId,
            receipt.sessionId,
            sourceTransactionKey,
            settlementKey,
            proof.blockHeight,
            transactionIndex,
            receipt.finalAmount
        );
    }

    function receiptDigest(ChargingReceipt memory receipt) public view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                EIP712_DOMAIN_TYPEHASH,
                keccak256(bytes(EIP712_NAME)),
                keccak256(bytes(EIP712_VERSION)),
                SOURCE_CHAIN_ID,
                expectedSourceRegistry
            )
        );
        bytes32 structHash = keccak256(
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
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }

    function expectedSessionId(ChargingReceipt memory receipt) public pure returns (bytes32) {
        return keccak256(
            abi.encode(receipt.intentId, receipt.stationId, receipt.driver, receipt.startedAt, receipt.nonce)
        );
    }

    function _decodeAndValidateTransaction(
        bytes calldata encodedTransaction
    ) private view returns (ChargingReceipt memory receipt, bytes memory deviceSignature) {
        uint8 transactionType = EvmV1Decoder.getTransactionType(encodedTransaction);
        if (!EvmV1Decoder.isValidTransactionType(transactionType)) {
            revert UnsupportedTransactionType(transactionType);
        }

        EvmV1Decoder.ReceiptFields memory sourceReceipt = EvmV1Decoder.decodeReceiptFields(
            encodedTransaction
        );
        if (sourceReceipt.receiptStatus != 1) {
            revert InvalidReceiptStatus(sourceReceipt.receiptStatus);
        }

        EvmV1Decoder.CommonTxFields memory transactionData = EvmV1Decoder.decodeCommonTxFields(
            encodedTransaction
        );
        if (transactionData.toIsNull || transactionData.to != expectedSourceRegistry) {
            revert IncorrectSourceContract(transactionData.to, expectedSourceRegistry);
        }
        if (transactionData.data.length < 4) revert EmptyCalldata();

        bytes4 selector;
        bytes memory callData = transactionData.data;
        assembly ("memory-safe") {
            selector := mload(add(callData, 32))
        }
        if (selector != FINALIZE_SESSION_SELECTOR) {
            revert IncorrectFunctionSelector(selector, FINALIZE_SESSION_SELECTOR);
        }

        bytes memory arguments = new bytes(callData.length - 4);
        for (uint256 i = 4; i < callData.length; ++i) {
            arguments[i - 4] = callData[i];
        }
        (receipt, deviceSignature) = abi.decode(arguments, (ChargingReceipt, bytes));
        if (transactionData.from != receipt.driver) {
            revert IncorrectDriver(transactionData.from, receipt.driver);
        }
    }

    function _validateReceipt(
        ChargingReceipt memory receipt,
        bytes memory deviceSignature,
        IChargeIntentEscrow.IntentSnapshot memory intent
    ) private view {
        if (intent.state != 1) revert InactiveIntent(receipt.intentId, intent.state);
        if (
            intent.sourceChainKey != expectedSourceChainKey ||
            intent.sourceRegistry != expectedSourceRegistry
        ) revert NetworkBindingMismatch();
        if (receipt.driver != intent.driver) revert IncorrectDriver(receipt.driver, intent.driver);
        if (receipt.stationId != intent.stationId) {
            revert IncorrectStation(receipt.stationId, intent.stationId);
        }
        if (receipt.tariff != intent.tariff) revert IncorrectTariff(receipt.tariff, intent.tariff);
        if (
            receipt.startedAt < intent.openedAt &&
            intent.openedAt - receipt.startedAt > INTENT_START_CLOCK_SKEW
        ) {
            revert SessionStartedBeforeIntent(receipt.startedAt, intent.openedAt);
        }
        if (receipt.endedAt > intent.expiresAt) {
            revert SessionEndedAfterExpiry(receipt.endedAt, intent.expiresAt);
        }
        if (
            receipt.endedAt < receipt.startedAt ||
            receipt.endedAt - receipt.startedAt > MAX_SESSION_DURATION
        ) revert InvalidSessionWindow(receipt.startedAt, receipt.endedAt);
        if (receipt.energyWh == 0) revert InvalidEnergy();

        bytes32 calculatedSessionId = expectedSessionId(receipt);
        if (receipt.sessionId != calculatedSessionId) {
            revert InvalidSessionId(receipt.sessionId, calculatedSessionId);
        }

        uint256 calculatedAmount = Math.mulDiv(
            uint256(receipt.energyWh),
            receipt.tariff,
            1_000,
            Math.Rounding.Ceil
        );
        if (receipt.finalAmount != calculatedAmount) {
            revert IncorrectAmount(receipt.finalAmount, calculatedAmount);
        }
        if (receipt.finalAmount > intent.maxPayment) {
            revert AmountAboveEscrow(receipt.finalAmount, intent.maxPayment);
        }

        (address recovered, ECDSA.RecoverError recoverError,) = ECDSA.tryRecover(
            receiptDigest(receipt),
            deviceSignature
        );
        if (recoverError != ECDSA.RecoverError.NoError || recovered != intent.deviceSigner) {
            revert IncorrectDeviceSigner(recovered, intent.deviceSigner);
        }
    }
}
