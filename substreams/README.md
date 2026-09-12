# Float Substreams — Real-Time Stream Engine on Arc

Float Substreams processes live event logs from `FloatCreditFacility.sol` on Arc Testnet, transforming them into derived financial and credit analytics in real time.

## Streamed Events
- **Borrow / Drawdown**: Emitted when an x402 overdraft is funded by Float
- **Repay**: Emitted when a human operator or sibling agent repays outstanding credit
- **Payment**: Tracks individual x402 resource access authorization
- **Default**: Emitted when delinquent loans exceed facility terms
- **CreditLimitChanged**: Facility limit adjustments
- **AgentAdded / AgentRevoked**: Autonomous machine authorization changes

## Derived Metrics
- `current_outstanding_debt`: Human-level active credit balance
- `total_borrowed` / `total_repaid`: Lifetime protocol turnover
- `repayment_rate`: Ratio of recovered principal to borrowed liquidity
- `credit_utilization`: Dynamic exposure relative to the $500 facility cap
- `human_exposure`: Consolidated multi-agent risk profile for each World ID-verified operator

## Build & Run
```bash
substreams build
substreams gui ./substreams.yaml map_live_metrics
```
