// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test-only token that can fail transfers or attempt a callback during `transfer`.
contract AdversarialERC20 is ERC20 {
    bool public failTransfers;
    bool public reentryEnabled;
    bool public reentryAttempted;
    bool public reentrySucceeded;
    address public reentryTarget;
    bytes public reentryCalldata;
    bool private _insideCallback;

    error ForcedTransferFailure();

    constructor() ERC20("Adversarial test USD", "aUSD") {}

    function decimals() public pure override returns (uint8) {
        return 6;
    }

    function faucet() external {
        _mint(msg.sender, 100_000_000);
    }

    function setFailTransfers(bool value) external {
        failTransfers = value;
    }

    function configureReentry(address target, bytes calldata callback, bool enabled) external {
        reentryTarget = target;
        reentryCalldata = callback;
        reentryEnabled = enabled;
        reentryAttempted = false;
        reentrySucceeded = false;
    }

    function transfer(address to, uint256 value) public override returns (bool) {
        if (failTransfers) revert ForcedTransferFailure();
        if (reentryEnabled && !_insideCallback) {
            _insideCallback = true;
            reentryAttempted = true;
            (reentrySucceeded,) = reentryTarget.call(reentryCalldata);
            _insideCallback = false;
        }
        return super.transfer(to, value);
    }
}
