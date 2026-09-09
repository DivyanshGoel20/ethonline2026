# Float

> Controlled USDC credit lines for AI agents.

Float gives an AI agent a controlled USDC credit line so the agent can continue operating when it temporarily has insufficient balance. Borrowing and repayments are handled through clean agent APIs, settled on Arc, verified by World Selfie Check, and indexed as standardized financial history by The Graph.

---

## Repository Structure

```text
.
├── contracts/        # Foundry smart contracts for Arc settlement & credit management
├── web/              # Next.js 14 fullstack app (Dashboard & Agent Borrow/Repay APIs)
├── subgraph/         # The Graph standardized schema and indexing manifest
├── agent-demo/       # Simulation runner for x402 nanopayment demo
├── docs/             # Sponsor feedback documents and technical architecture
├── .env.example      # Environment variables template
└── package.json      # Monorepo root workspace configuration
```

## Sponsor Integrations

- **World**: Selfie Check human entry point ensuring human accountability and Sybil/abuse resistance for agent managers.
- **Arc / Circle**: Settlement layer for USDC credit issuance, repayment, and machine-to-machine x402 nanopayments.
- **The Graph**: Structured financial data layer indexing borrowing, repayment, and credit history with standardized schemas.

---

## Quick Start

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure environment:**
   ```bash
   cp .env.example .env
   ```

3. **Run web app (frontend + APIs):**
   ```bash
   npm run dev
   ```

4. **Run agent demo simulator:**
   ```bash
   npm run dev:mock   # Start test HTTP 402 service
   npm run dev:agent  # Run autonomous agent lifecycle
   ```