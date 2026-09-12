// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IERC20Minimal {
    function transfer(address to, uint256 amount) external returns (bool);
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}

/**
 * @title FloatCreditFacility
 * @notice Authoritative financial ledger for Float's credit facilities on Arc.
 *         Tracks human credit profiles, authorized AI agents, drawdowns, and repayments.
 *         Important: Drawdowns record and authorize credit; actual x402 payment
 *         is executed via Float's Gateway funding balance.
 */
contract FloatCreditFacility {
    address public owner;
    IERC20Minimal public usdc;

    enum ProfileStatus { Inactive, Active, Suspended, Defaulted }
    enum LoanStatus { Active, Settled, Defaulted }

    struct CreditProfile {
        bytes32 profileId;
        address humanOwner;
        bytes32 humanRoot;        // World ID root or reference hash
        uint256 creditLimit;      // e.g., 500 * 1e6 ($500.00 USDC)
        uint256 outstandingDebt;
        uint256 totalBorrowed;
        uint256 totalRepaid;
        ProfileStatus status;
        uint256 createdAt;
    }

    struct AgentAuthorization {
        bytes32 profileId;
        bool isActive;
        uint256 authorizedAt;
    }

    struct Drawdown {
        uint256 loanId;
        bytes32 profileId;
        address agentAddress;
        uint256 amount;
        uint256 timestamp;
        LoanStatus status;
        string paymentReference; // e.g., x402 paymentId or resourceUrl
    }

    struct RepaymentRecord {
        uint256 repaymentId;
        bytes32 profileId;
        address payer;
        address beneficiaryAgent;
        uint256 amount;
        uint256 timestamp;
    }

    // Storage
    mapping(bytes32 => CreditProfile) public profiles;
    bytes32[] public profileIds;
    mapping(address => bytes32) public humanToProfile;
    mapping(address => AgentAuthorization) public agentAuthorizations;
    mapping(uint256 => Drawdown) public drawdowns;
    uint256 public nextLoanId = 1;
    mapping(uint256 => RepaymentRecord) public repayments;
    uint256 public nextRepaymentId = 1;

    // Events explicitly indexed for Subgraph / Substreams
    event CreditProfileCreated(bytes32 indexed profileId, address indexed humanOwner, bytes32 humanRoot, uint256 creditLimit);
    event CreditLimitUpdated(bytes32 indexed profileId, uint256 oldLimit, uint256 newLimit);
    event ProfileStatusChanged(bytes32 indexed profileId, ProfileStatus status);
    event AgentAuthorized(bytes32 indexed profileId, address indexed agentAddress, uint256 timestamp);
    event AgentRevoked(bytes32 indexed profileId, address indexed agentAddress, uint256 timestamp);
    event DrawdownRecorded(
        uint256 indexed loanId,
        bytes32 indexed profileId,
        address indexed agentAddress,
        uint256 amount,
        uint256 newOutstandingDebt,
        uint256 timestamp,
        string paymentReference
    );
    event RepaymentRecorded(
        uint256 indexed repaymentId,
        bytes32 indexed profileId,
        address indexed payer,
        address beneficiaryAgent,
        uint256 amount,
        uint256 remainingDebt,
        uint256 timestamp
    );
    event DefaultMarked(bytes32 indexed profileId, uint256 outstandingDebt, uint256 timestamp);

    modifier onlyOwner() {
        require(msg.sender == owner, "FloatCreditFacility: not contract owner");
        _;
    }

    constructor(address _usdc) {
        owner = msg.sender;
        if (_usdc != address(0)) {
            usdc = IERC20Minimal(_usdc);
        }
    }

    function setToken(address _usdc) external onlyOwner {
        usdc = IERC20Minimal(_usdc);
    }

    function transferOwnership(address newOwner) external onlyOwner {
        require(newOwner != address(0), "Invalid owner");
        owner = newOwner;
    }

    /**
     * @notice Creates or activates a Human Credit Profile.
     */
    function createCreditProfile(
        bytes32 profileId,
        address humanOwner,
        bytes32 humanRoot,
        uint256 initialCreditLimit
    ) external {
        require(msg.sender == owner || msg.sender == humanOwner, "Unauthorized");
        require(profiles[profileId].createdAt == 0, "Profile already exists");
        require(humanOwner != address(0), "Invalid human owner");

        profiles[profileId] = CreditProfile({
            profileId: profileId,
            humanOwner: humanOwner,
            humanRoot: humanRoot,
            creditLimit: initialCreditLimit,
            outstandingDebt: 0,
            totalBorrowed: 0,
            totalRepaid: 0,
            status: ProfileStatus.Active,
            createdAt: block.timestamp
        });

        profileIds.push(profileId);
        humanToProfile[humanOwner] = profileId;

        emit CreditProfileCreated(profileId, humanOwner, humanRoot, initialCreditLimit);
    }

    /**
     * @notice Set or update the credit limit of a human profile.
     */
    function setCreditLimit(bytes32 profileId, uint256 newLimit) external {
        CreditProfile storage profile = profiles[profileId];
        require(profile.createdAt > 0, "Profile does not exist");
        require(msg.sender == owner || msg.sender == profile.humanOwner, "Unauthorized");

        uint256 oldLimit = profile.creditLimit;
        profile.creditLimit = newLimit;

        emit CreditLimitUpdated(profileId, oldLimit, newLimit);
    }

    /**
     * @notice Update the operational status of a profile (Active, Suspended, Defaulted).
     */
    function setProfileStatus(bytes32 profileId, ProfileStatus status) external {
        CreditProfile storage profile = profiles[profileId];
        require(profile.createdAt > 0, "Profile does not exist");
        require(msg.sender == owner || msg.sender == profile.humanOwner, "Unauthorized");

        profile.status = status;
        emit ProfileStatusChanged(profileId, status);
    }

    /**
     * @notice Authorize an AI agent to draw against the human credit facility.
     */
    function authorizeAgent(bytes32 profileId, address agentAddress) external {
        CreditProfile storage profile = profiles[profileId];
        require(profile.createdAt > 0, "Profile does not exist");
        require(msg.sender == owner || msg.sender == profile.humanOwner, "Unauthorized");
        require(agentAddress != address(0), "Invalid agent address");

        agentAuthorizations[agentAddress] = AgentAuthorization({
            profileId: profileId,
            isActive: true,
            authorizedAt: block.timestamp
        });

        emit AgentAuthorized(profileId, agentAddress, block.timestamp);
    }

    /**
     * @notice Revoke an AI agent's authorization.
     */
    function revokeAgent(bytes32 profileId, address agentAddress) external {
        CreditProfile storage profile = profiles[profileId];
        require(profile.createdAt > 0, "Profile does not exist");
        require(msg.sender == owner || msg.sender == profile.humanOwner, "Unauthorized");
        require(agentAuthorizations[agentAddress].profileId == profileId, "Agent not associated with profile");

        agentAuthorizations[agentAddress].isActive = false;

        emit AgentRevoked(profileId, agentAddress, block.timestamp);
    }

    /**
     * @notice Records an overdraft credit drawdown against the human facility.
     *         Enforces credit limit and authorization.
     *         Actual payment is made via Float Gateway funding balance.
     */
    function recordDrawdown(
        bytes32 profileId,
        address agentAddress,
        uint256 amount,
        string calldata paymentReference
    ) external returns (uint256 loanId) {
        CreditProfile storage profile = profiles[profileId];
        require(profile.createdAt > 0, "Profile does not exist");
        require(profile.status == ProfileStatus.Active, "Profile is not active");

        // Validate agent authorization
        AgentAuthorization storage auth = agentAuthorizations[agentAddress];
        require(auth.isActive && auth.profileId == profileId, "Agent not authorized for this profile");

        // Validate caller (contract owner/operator, human owner, or authorized agent)
        require(
            msg.sender == owner || msg.sender == profile.humanOwner || msg.sender == agentAddress,
            "Unauthorized drawdown caller"
        );

        // Check credit headroom
        require(profile.outstandingDebt + amount <= profile.creditLimit, "Requested drawdown exceeds credit limit");

        profile.outstandingDebt += amount;
        profile.totalBorrowed += amount;

        loanId = nextLoanId++;
        drawdowns[loanId] = Drawdown({
            loanId: loanId,
            profileId: profileId,
            agentAddress: agentAddress,
            amount: amount,
            timestamp: block.timestamp,
            status: LoanStatus.Active,
            paymentReference: paymentReference
        });

        emit DrawdownRecorded(
            loanId,
            profileId,
            agentAddress,
            amount,
            profile.outstandingDebt,
            block.timestamp,
            paymentReference
        );
    }

    /**
     * @notice Records a repayment against the human profile.
     *         Any authorized payer (agent or human) can repay debt.
     *         Excess repayment is not deducted from debt.
     */
    function recordRepayment(
        bytes32 profileId,
        address payer,
        address beneficiaryAgent,
        uint256 amount
    ) external returns (uint256 actualRepaid, uint256 remainingDebt) {
        CreditProfile storage profile = profiles[profileId];
        require(profile.createdAt > 0, "Profile does not exist");
        require(profile.outstandingDebt > 0, "No outstanding debt to repay");
        require(msg.sender == owner || msg.sender == profile.humanOwner || msg.sender == payer, "Unauthorized caller");

        actualRepaid = amount > profile.outstandingDebt ? profile.outstandingDebt : amount;
        profile.outstandingDebt -= actualRepaid;
        profile.totalRepaid += actualRepaid;
        remainingDebt = profile.outstandingDebt;

        uint256 repId = nextRepaymentId++;
        repayments[repId] = RepaymentRecord({
            repaymentId: repId,
            profileId: profileId,
            payer: payer,
            beneficiaryAgent: beneficiaryAgent,
            amount: actualRepaid,
            timestamp: block.timestamp
        });

        emit RepaymentRecorded(
            repId,
            profileId,
            payer,
            beneficiaryAgent,
            actualRepaid,
            remainingDebt,
            block.timestamp
        );
    }

    /**
     * @notice On-chain USDC repayment where tokens are transferred directly into this contract.
     */
    function repayWithToken(
        bytes32 profileId,
        address beneficiaryAgent,
        uint256 amount
    ) external returns (uint256 actualRepaid, uint256 remainingDebt) {
        require(address(usdc) != address(0), "USDC token not configured");
        CreditProfile storage profile = profiles[profileId];
        require(profile.createdAt > 0, "Profile does not exist");
        require(profile.outstandingDebt > 0, "No outstanding debt");

        actualRepaid = amount > profile.outstandingDebt ? profile.outstandingDebt : amount;

        // Pull tokens from sender
        require(usdc.transferFrom(msg.sender, address(this), actualRepaid), "USDC transferFrom failed");

        profile.outstandingDebt -= actualRepaid;
        profile.totalRepaid += actualRepaid;
        remainingDebt = profile.outstandingDebt;

        uint256 repId = nextRepaymentId++;
        repayments[repId] = RepaymentRecord({
            repaymentId: repId,
            profileId: profileId,
            payer: msg.sender,
            beneficiaryAgent: beneficiaryAgent,
            amount: actualRepaid,
            timestamp: block.timestamp
        });

        emit RepaymentRecorded(
            repId,
            profileId,
            msg.sender,
            beneficiaryAgent,
            actualRepaid,
            remainingDebt,
            block.timestamp
        );
    }

    /**
     * @notice Mark a profile as defaulted if loans remain unpaid past terms.
     */
    function markDefault(bytes32 profileId) external onlyOwner {
        CreditProfile storage profile = profiles[profileId];
        require(profile.createdAt > 0, "Profile does not exist");
        require(profile.outstandingDebt > 0, "No outstanding debt");

        profile.status = ProfileStatus.Defaulted;
        emit DefaultMarked(profileId, profile.outstandingDebt, block.timestamp);
    }

    // View functions
    function getProfile(bytes32 profileId) external view returns (CreditProfile memory) {
        return profiles[profileId];
    }

    function getRemainingCredit(bytes32 profileId) external view returns (uint256) {
        CreditProfile memory p = profiles[profileId];
        if (p.status != ProfileStatus.Active) return 0;
        return p.creditLimit > p.outstandingDebt ? p.creditLimit - p.outstandingDebt : 0;
    }

    function getOutstandingDebt(bytes32 profileId) external view returns (uint256) {
        return profiles[profileId].outstandingDebt;
    }

    function isAgentAuthorized(bytes32 profileId, address agentAddress) external view returns (bool) {
        AgentAuthorization memory auth = agentAuthorizations[agentAddress];
        return auth.isActive && auth.profileId == profileId;
    }

    function getAgentProfileId(address agentAddress) external view returns (bytes32) {
        return agentAuthorizations[agentAddress].profileId;
    }

    function getDrawdown(uint256 loanId) external view returns (Drawdown memory) {
        return drawdowns[loanId];
    }

    function getProfileCount() external view returns (uint256) {
        return profileIds.length;
    }
}
