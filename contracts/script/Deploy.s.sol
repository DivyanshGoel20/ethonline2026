// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockUSDC} from "../src/MockUSDC.sol";
import {FloatCreditManager} from "../src/FloatCreditManager.sol";

contract DeployFloat {
    function run() external returns (address usdcAddr, address managerAddr) {
        // Deploy Mock USDC (or use existing Arc USDC if address provided)
        MockUSDC usdc = new MockUSDC();
        FloatCreditManager manager = new FloatCreditManager(address(usdc));

        // Provide initial pool liquidity (e.g. 50,000 USDC)
        usdc.mint(address(this), 50_000 * 1e6);
        usdc.approve(address(manager), 50_000 * 1e6);
        manager.supplyLiquidity(50_000 * 1e6);

        return (address(usdc), address(manager));
    }
}
