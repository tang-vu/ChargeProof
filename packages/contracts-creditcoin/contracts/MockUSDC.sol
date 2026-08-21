// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @title MockUSDC
/// @notice Faucet token for testnet demonstrations only. It has no monetary value.
contract MockUSDC is ERC20 {
    uint256 public constant FAUCET_AMOUNT = 100e6;
    uint64 public constant FAUCET_COOLDOWN = 1 days;

    mapping(address account => uint64 timestamp) public lastFaucetAt;

    error FaucetCooldown(uint64 nextAvailableAt);

    event FaucetMint(address indexed account, uint256 amount, uint64 nextAvailableAt);

    constructor() ERC20("ChargeProof Demo USDC", "cpUSDC") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        uint64 last = lastFaucetAt[msg.sender];
        uint64 nowTime = uint64(block.timestamp);
        if (last != 0 && nowTime < last + FAUCET_COOLDOWN) {
            revert FaucetCooldown(last + FAUCET_COOLDOWN);
        }
        lastFaucetAt[msg.sender] = nowTime;
        _mint(msg.sender, FAUCET_AMOUNT);
        emit FaucetMint(msg.sender, FAUCET_AMOUNT, nowTime + FAUCET_COOLDOWN);
    }
}
