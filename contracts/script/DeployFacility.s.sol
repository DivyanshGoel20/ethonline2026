// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {MockUSDC} from "../src/MockUSDC.sol";
import {FloatCreditFacility} from "../src/FloatCreditFacility.sol";

contract DeployFacility {
    function run() external returns (address usdcAddr, address facilityAddr) {
        MockUSDC usdc = new MockUSDC();
        FloatCreditFacility facility = new FloatCreditFacility(address(usdc));

        return (address(usdc), address(facility));
    }
}
