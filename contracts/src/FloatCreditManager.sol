// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title FloatCreditManager
 * @notice Manages controlled USDC credit facilities for autonomous AI agents.
 *         Agents can borrow within assigned limits and repay when revenue is earned.
 *         All key financial actions emit events indexed by The Graph.
 */
contract FloatCreditManager {
    IERC20Minimal public immutable usdc;
    address public owner;

    struct CreditProfile {
        address agentAddress;
        address humanOwner;
        string name;
        uint256 creditLimit;
        uint256 outstandingDebt;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        bool isActive;
        uint256 registeredAt;
    }

    mapping(address => CreditProfile) public agents;
    address[] public registeredAgents;

    // Events explicitly required by Float specification and The Graph Subgraph schema
    event AgentRegistered(address indexed agentAddress, address indexed humanOwner, string name, uint256 creditLimit);
    event BorrowCreated(address indexed agentAddress, uint256 amount, uint256 newOutstandingDebt, uint256 timestamp);
    event RepaymentMade(address indexed agentAddress, uint256 amount, uint256 remainingDebt, uint256 timestamp);
    event CreditLimitUpdated(address indexed agentAddress, uint256 oldLimit, uint256 newLimit);
    event CreditStatusChanged(address indexed agentAddress, bool isActive);
    event LiquiditySupplied(address indexed provider, uint256 amount);

    modifier onlyOwner() {
        require(msg.sender == owner, "FloatCreditManager: not contract owner");
        _;
    }

    constructor(address _usdc) {
        require(_usdc != address(0), "FloatCreditManager: invalid token address");
        owner = msg.sender;
        usdc = IERC20Minimal(_usdc);
    }

    /**
     * @notice Registers an agent to a verified human owner with an assigned credit limit.
     */
    function registerAgent(
        address agentAddress,
        address humanOwner,
        string calldata name,
        uint256 initialCreditLimit
    ) external {
        require(msg.sender == owner || msg.sender == humanOwner, "Unauthorized");
        require(agentAddress != address(0), "Invalid agent address");
        require(agents[agentAddress].registeredAt == 0, "Agent already registered");

        agents[agentAddress] = CreditProfile({
            agentAddress: agentAddress,
            humanOwner: humanOwner,
            name: name,
            creditLimit: initialCreditLimit,
            outstandingDebt: 0,
            totalBorrowed: 0,
            totalRepaid: 0,
            isActive: true,
            registeredAt: block.timestamp
        });

        registeredAgents.push(agentAddress);

        emit AgentRegistered(agentAddress, humanOwner, name, initialCreditLimit);
    }

    /**
     * @notice Allows an agent or its authorized controller to draw liquidity from its credit facility.
     */
    function borrow(address agentAddress, uint256 amount) external {
        CreditProfile storage profile = agents[agentAddress];
        require(profile.isActive, "Agent credit facility is inactive");
        require(profile.registeredAt > 0, "Agent not registered");
        require(msg.sender == agentAddress || msg.sender == profile.humanOwner || msg.sender == owner, "Unauthorized caller");

        uint256 availableCredit = profile.creditLimit > profile.outstandingDebt ? profile.creditLimit - profile.outstandingDebt : 0;
        require(amount <= availableCredit, "Requested amount exceeds available credit limit");

        profile.outstandingDebt += amount;
        profile.totalBorrowed += amount;

        // Disburse USDC liquidity directly to the agent address
        require(usdc.transfer(agentAddress, amount), "USDC transfer failed");

        emit BorrowCreated(agentAddress, amount, profile.outstandingDebt, block.timestamp);
    }

    /**
     * @notice Repays outstanding credit for an agent. Can be invoked by the agent or any caller on its behalf.
     */
    function repay(address agentAddress, uint256 amount) external {
        CreditProfile storage profile = agents[agentAddress];
        require(profile.registeredAt > 0, "Agent not registered");
        require(profile.outstandingDebt > 0, "No outstanding debt to repay");

        uint256 repayAmount = amount > profile.outstandingDebt ? profile.outstandingDebt : amount;

        profile.outstandingDebt -= repayAmount;
        profile.totalRepaid += repayAmount;

        // Collect USDC repayment from caller
        require(usdc.transferFrom(msg.sender, address(this), repayAmount), "USDC repayment transfer failed");

        emit RepaymentMade(agentAddress, repayAmount, profile.outstandingDebt, block.timestamp);
    }

    /**
     * @notice Updates the credit limit assigned to an agent.
     */
    function setCreditLimit(address agentAddress, uint256 newLimit) external {
        CreditProfile storage profile = agents[agentAddress];
        require(profile.registeredAt > 0, "Agent not registered");
        require(msg.sender == profile.humanOwner || msg.sender == owner, "Unauthorized");

        uint256 oldLimit = profile.creditLimit;
        profile.creditLimit = newLimit;

        emit CreditLimitUpdated(agentAddress, oldLimit, newLimit);
    }

    /**
     * @notice Suspends or re-activates an agent's borrowing capability.
     */
    function setAgentStatus(address agentAddress, bool isActive) external {
        CreditProfile storage profile = agents[agentAddress];
        require(profile.registeredAt > 0, "Agent not registered");
        require(msg.sender == profile.humanOwner || msg.sender == owner, "Unauthorized");

        profile.isActive = isActive;
        emit CreditStatusChanged(agentAddress, isActive);
    }

    /**
     * @notice Injects reserve USDC liquidity into the credit pool.
     */
    function supplyLiquidity(uint256 amount) external {
        require(usdc.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        emit LiquiditySupplied(msg.sender, amount);
    }

    /**
     * @notice Returns complete credit profile details for an agent.
     */
    function getCreditProfile(address agentAddress) external view returns (CreditProfile memory) {
        return agents[agentAddress];
    }

    /**
     * @notice Total count of registered agents.
     */
    function getAgentCount() external view returns (uint256) {
        return registeredAgents.length;
    }
}
