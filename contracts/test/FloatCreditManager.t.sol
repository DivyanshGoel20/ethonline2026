// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockUSDC} from "../src/MockUSDC.sol";
import {FloatCreditManager} from "../src/FloatCreditManager.sol";

// Minimal test harness matching Foundry expectations
abstract contract TestHelper {
    function assertTrue(bool condition) internal pure {
        require(condition, "Assertion failed: expected true");
    }

    function assertEq(uint256 a, uint256 b) internal pure {
        require(a == b, "Assertion failed: values not equal");
    }

    function assertEq(address a, address b) internal pure {
        require(a == b, "Assertion failed: addresses not equal");
    }
}

contract FloatCreditManagerTest is TestHelper {
    MockUSDC public usdc;
    FloatCreditManager public creditManager;

    address public owner = address(this);
    address public humanOwner = address(0x1111);
    address public agent = address(0x2222);

    function setUp() public {
        usdc = new MockUSDC();
        creditManager = new FloatCreditManager(address(usdc));

        // Fund credit manager with 10,000 USDC reserve liquidity
        usdc.mint(address(this), 10_000 * 1e6);
        usdc.approve(address(creditManager), 10_000 * 1e6);
        creditManager.supplyLiquidity(10_000 * 1e6);
    }

    function testRegisterAgent() public {
        creditManager.registerAgent(agent, humanOwner, "Test Agent", 500 * 1e6);

        FloatCreditManager.CreditProfile memory profile = creditManager.getCreditProfile(agent);
        assertEq(profile.agentAddress, agent);
        assertEq(profile.humanOwner, humanOwner);
        assertEq(profile.creditLimit, 500 * 1e6);
        assertEq(profile.outstandingDebt, 0);
        assertTrue(profile.isActive);
    }

    function testBorrowWithinLimit() public {
        creditManager.registerAgent(agent, humanOwner, "Test Agent", 100 * 1e6);

        creditManager.borrow(agent, 40 * 1e6);

        FloatCreditManager.CreditProfile memory profile = creditManager.getCreditProfile(agent);
        assertEq(profile.outstandingDebt, 40 * 1e6);
        assertEq(profile.totalBorrowed, 40 * 1e6);
        assertEq(usdc.balanceOf(agent), 40 * 1e6);
    }

    function testRepayDebt() public {
        creditManager.registerAgent(agent, humanOwner, "Test Agent", 100 * 1e6);
        creditManager.borrow(agent, 50 * 1e6);

        // Mint USDC to agent to simulate revenue and approve credit manager
        usdc.mint(address(this), 50 * 1e6);
        usdc.approve(address(creditManager), 50 * 1e6);

        creditManager.repay(agent, 50 * 1e6);

        FloatCreditManager.CreditProfile memory profile = creditManager.getCreditProfile(agent);
        assertEq(profile.outstandingDebt, 0);
        assertEq(profile.totalRepaid, 50 * 1e6);
    }
}
