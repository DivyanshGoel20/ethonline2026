import { BigInt, Bytes } from "@graphprotocol/graph-ts";
import {
  CreditProfileCreated,
  CreditLimitUpdated,
  ProfileStatusChanged,
  AgentAuthorized,
  AgentRevoked,
  DrawdownRecorded,
  RepaymentRecorded,
  DefaultMarked,
} from "../generated/FloatCreditFacility/FloatCreditFacility";
import {
  Facility,
  HumanCreditProfile,
  Agent,
  Drawdown,
  Repayment,
  DefaultRecord,
} from "../generated/schema";

const FACILITY_ID = "FLOAT_ARC_FACILITY";

function getOrCreateFacility(timestamp: BigInt): Facility {
  let facility = Facility.load(FACILITY_ID);
  if (facility == null) {
    facility = new Facility(FACILITY_ID);
    facility.totalProfiles = BigInt.fromI32(0);
    facility.totalDrawdowns = BigInt.fromI32(0);
    facility.totalRepayments = BigInt.fromI32(0);
    facility.totalVolumeBorrowed = BigInt.fromI32(0);
    facility.totalVolumeRepaid = BigInt.fromI32(0);
    facility.totalOutstandingExposure = BigInt.fromI32(0);
    facility.lastActivityTimestamp = timestamp;
    facility.save();
  }
  return facility;
}

export function handleCreditProfileCreated(event: CreditProfileCreated): void {
  let profileId = event.params.profileId.toHexString();
  let profile = new HumanCreditProfile(profileId);
  profile.humanOwner = event.params.humanOwner;
  profile.humanRoot = event.params.humanRoot;
  profile.creditLimit = event.params.creditLimit;
  profile.outstandingDebt = BigInt.fromI32(0);
  profile.totalBorrowed = BigInt.fromI32(0);
  profile.totalRepaid = BigInt.fromI32(0);
  profile.creditUtilizationBps = BigInt.fromI32(0);
  profile.status = "ACTIVE";
  profile.createdAt = event.block.timestamp;
  profile.save();

  let facility = getOrCreateFacility(event.block.timestamp);
  facility.totalProfiles = facility.totalProfiles.plus(BigInt.fromI32(1));
  facility.lastActivityTimestamp = event.block.timestamp;
  facility.save();
}

export function handleCreditLimitUpdated(event: CreditLimitUpdated): void {
  let profileId = event.params.profileId.toHexString();
  let profile = HumanCreditProfile.load(profileId);
  if (profile != null) {
    profile.creditLimit = event.params.newLimit;
    if (profile.creditLimit.gt(BigInt.fromI32(0))) {
      profile.creditUtilizationBps = profile.outstandingDebt
        .times(BigInt.fromI32(10000))
        .div(profile.creditLimit);
    }
    profile.save();
  }
}

export function handleProfileStatusChanged(event: ProfileStatusChanged): void {
  let profileId = event.params.profileId.toHexString();
  let profile = HumanCreditProfile.load(profileId);
  if (profile != null) {
    let statusNum = event.params.status;
    if (statusNum == 0) {
      profile.status = "INACTIVE";
    } else if (statusNum == 1) {
      profile.status = "ACTIVE";
    } else if (statusNum == 2) {
      profile.status = "SUSPENDED";
    } else if (statusNum == 3) {
      profile.status = "DEFAULTED";
    }
    profile.save();
  }
}

export function handleAgentAuthorized(event: AgentAuthorized): void {
  let agentId = event.params.agentAddress.toHexString();
  let agent = Agent.load(agentId);
  if (agent == null) {
    agent = new Agent(agentId);
    agent.agentAddress = event.params.agentAddress;
  }
  agent.humanProfile = event.params.profileId.toHexString();
  agent.isActive = true;
  agent.authorizedAt = event.params.timestamp;
  agent.save();
}

export function handleAgentRevoked(event: AgentRevoked): void {
  let agentId = event.params.agentAddress.toHexString();
  let agent = Agent.load(agentId);
  if (agent != null) {
    agent.isActive = false;
    agent.save();
  }
}

export function handleDrawdownRecorded(event: DrawdownRecorded): void {
  let drawdownId = event.params.loanId.toString();
  let drawdown = new Drawdown(drawdownId);
  drawdown.humanProfile = event.params.profileId.toHexString();
  drawdown.agent = event.params.agentAddress.toHexString();
  drawdown.amount = event.params.amount;
  drawdown.outstandingDebtAfter = event.params.newOutstandingDebt;
  drawdown.paymentReference = event.params.paymentReference;
  drawdown.timestamp = event.params.timestamp;
  drawdown.transactionHash = event.transaction.hash;
  drawdown.save();

  let profile = HumanCreditProfile.load(event.params.profileId.toHexString());
  if (profile != null) {
    profile.outstandingDebt = event.params.newOutstandingDebt;
    profile.totalBorrowed = profile.totalBorrowed.plus(event.params.amount);
    if (profile.creditLimit.gt(BigInt.fromI32(0))) {
      profile.creditUtilizationBps = profile.outstandingDebt
        .times(BigInt.fromI32(10000))
        .div(profile.creditLimit);
    }
    profile.save();
  }

  let facility = getOrCreateFacility(event.block.timestamp);
  facility.totalDrawdowns = facility.totalDrawdowns.plus(BigInt.fromI32(1));
  facility.totalVolumeBorrowed = facility.totalVolumeBorrowed.plus(event.params.amount);
  facility.totalOutstandingExposure = facility.totalOutstandingExposure.plus(event.params.amount);
  facility.lastActivityTimestamp = event.block.timestamp;
  facility.save();
}

export function handleRepaymentRecorded(event: RepaymentRecorded): void {
  let repaymentId = event.params.repaymentId.toString();
  let repayment = new Repayment(repaymentId);
  repayment.humanProfile = event.params.profileId.toHexString();
  repayment.payer = event.params.payer;
  if (event.params.beneficiaryAgent != Bytes.fromHexString("0x0000000000000000000000000000000000000000")) {
    repayment.beneficiaryAgent = event.params.beneficiaryAgent.toHexString();
  }
  repayment.amount = event.params.amount;
  repayment.remainingDebt = event.params.remainingDebt;
  repayment.timestamp = event.params.timestamp;
  repayment.transactionHash = event.transaction.hash;
  repayment.save();

  let profile = HumanCreditProfile.load(event.params.profileId.toHexString());
  if (profile != null) {
    profile.outstandingDebt = event.params.remainingDebt;
    profile.totalRepaid = profile.totalRepaid.plus(event.params.amount);
    if (profile.creditLimit.gt(BigInt.fromI32(0))) {
      profile.creditUtilizationBps = profile.outstandingDebt
        .times(BigInt.fromI32(10000))
        .div(profile.creditLimit);
    }
    profile.save();
  }

  let facility = getOrCreateFacility(event.block.timestamp);
  facility.totalRepayments = facility.totalRepayments.plus(BigInt.fromI32(1));
  facility.totalVolumeRepaid = facility.totalVolumeRepaid.plus(event.params.amount);
  if (facility.totalOutstandingExposure.gt(event.params.amount)) {
    facility.totalOutstandingExposure = facility.totalOutstandingExposure.minus(event.params.amount);
  } else {
    facility.totalOutstandingExposure = BigInt.fromI32(0);
  }
  facility.lastActivityTimestamp = event.block.timestamp;
  facility.save();
}

export function handleDefaultMarked(event: DefaultMarked): void {
  let defaultId = event.transaction.hash.toHexString() + "-" + event.params.profileId.toHexString();
  let defaultRecord = new DefaultRecord(defaultId);
  defaultRecord.humanProfile = event.params.profileId.toHexString();
  defaultRecord.outstandingDebt = event.params.outstandingDebt;
  defaultRecord.timestamp = event.params.timestamp;
  defaultRecord.transactionHash = event.transaction.hash;
  defaultRecord.save();

  let profile = HumanCreditProfile.load(event.params.profileId.toHexString());
  if (profile != null) {
    profile.status = "DEFAULTED";
    profile.save();
  }
}
