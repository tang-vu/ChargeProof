// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {INativeQueryVerifier} from "@gluwa/usc-contracts/contracts/write-ability/common/INativeQueryVerifier.sol";

contract MockNativeQueryVerifier is INativeQueryVerifier {
    bool public shouldVerify = true;
    bool public shouldRevert;
    uint64 public transactionIndex = 7;

    function configure(bool verifyResult, bool revertCall, uint64 index) external {
        shouldVerify = verifyResult;
        shouldRevert = revertCall;
        transactionIndex = index;
    }

    function verifyAndEmit(
        uint64 chainKey,
        uint64 height,
        bytes calldata,
        MerkleProof calldata,
        ContinuityProof calldata
    ) external returns (bool) {
        if (shouldRevert) revert("mock malformed proof");
        if (shouldVerify) emit TransactionVerified(chainKey, height, transactionIndex);
        return shouldVerify;
    }

    function verifyAndEmit(
        uint64,
        uint64[] calldata,
        bytes[] calldata,
        MerkleProof[] calldata,
        ContinuityProof calldata
    ) external pure returns (bool) {
        revert("unused batch mock");
    }

    function verify(
        uint64,
        uint64,
        bytes calldata,
        MerkleProof calldata,
        ContinuityProof calldata
    ) external view returns (bool) {
        if (shouldRevert) revert("mock malformed proof");
        return shouldVerify;
    }

    function verify(
        uint64,
        uint64[] calldata,
        bytes[] calldata,
        MerkleProof[] calldata,
        ContinuityProof calldata
    ) external pure returns (bool) {
        revert("unused batch mock");
    }

    function calculateTxIndex(MerkleProof calldata) external view returns (uint64) {
        return transactionIndex;
    }
}
