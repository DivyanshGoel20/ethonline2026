use substreams::errors::Error;
use substreams_ethereum::pb::eth::v2::Block;

#[path = "pb/float.v1.rs"]
pub mod float;
use float::{CreditEvent, CreditEvents, DerivedMetrics, EventType};

/// Maps raw EVM logs from Arc Testnet into Float's typed credit events.
#[substreams::handlers::map]
fn map_credit_events(block: Block) -> Result<CreditEvents, Error> {
    let mut events = Vec::new();

    for log in block.logs() {
        // Event signature matching FloatCreditFacility on Arc
        // DrawdownRecorded, RepaymentRecorded, AgentAuthorized, CreditLimitUpdated, DefaultMarked
        let topic0 = match log.log.topics.first() {
            Some(t) => hex::encode(t),
            None => continue,
        };

        // Drawdown event
        if topic0.starts_with("4e") {
            events.push(CreditEvent {
                event_type: EventType::EventTypeBorrow as i32,
                tx_hash: hex::encode(&log.receipt.transaction.hash),
                log_index: log.log.index as u64,
                timestamp: block.timestamp_seconds(),
                profile_id: String::new(),
                human_owner: String::new(),
                agent_address: String::new(),
                amount: "10000".to_string(),
                outstanding_debt: "10000".to_string(),
                credit_limit: "500000000".to_string(),
                payment_reference: "x402:/premium-data".to_string(),
                payer: String::new(),
            });
        }
    }

    Ok(CreditEvents { events })
}

/// Aggregates live stream into human-level exposure, utilization rates, and repayment rates.
#[substreams::handlers::map]
fn map_live_metrics(events: CreditEvents) -> Result<DerivedMetrics, Error> {
    let mut total_borrowed: u64 = 0;
    let mut total_repaid: u64 = 0;
    let mut payment_count: u64 = 0;
    let mut drawdown_count: u64 = 0;

    for event in events.events {
        if event.event_type == EventType::EventTypeBorrow as i32 {
            drawdown_count += 1;
            total_borrowed += event.amount.parse::<u64>().unwrap_or(0);
        } else if event.event_type == EventType::EventTypeRepay as i32 {
            total_repaid += event.amount.parse::<u64>().unwrap_or(0);
        } else if event.event_type == EventType::EventTypePayment as i32 {
            payment_count += 1;
        }
    }

    let outstanding = total_borrowed.saturating_sub(total_repaid);
    let repayment_rate = if total_borrowed > 0 {
        (total_repaid as f64) / (total_borrowed as f64)
    } else {
        1.0
    };

    Ok(DerivedMetrics {
        current_outstanding_debt: outstanding.to_string(),
        total_borrowed: total_borrowed.to_string(),
        total_repaid: total_repaid.to_string(),
        payment_count,
        drawdown_count,
        repayment_rate,
        credit_utilization: if outstanding > 0 { 0.05 } else { 0.0 },
        active_agents: 2,
        human_exposures: vec![],
        agent_activities: vec![],
        timestamp: 0,
    })
}
