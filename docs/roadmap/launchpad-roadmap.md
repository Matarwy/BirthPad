# BirthPad Roadmap (TON Launchpad)

## Product Goal

Build a Telegram-first TON launchpad that is trusted by investors, fast for founders, and safe by default.

## Current Status (Already in Repo)

- Monorepo with `apps/api`, `apps/miniapp`, and `contracts`.
- Wallet session support in mini app (TON Connect).
- Launch create flow (project + sale metadata).
- Buy flow with queued and indexed transaction status.
- Finalize/refund queue endpoints.
- Basic role middleware, rate limiting, and audit middleware.
- Tact contracts compile in watch mode.

## Phase Plan

### Phase 1: MVP (Ship fast, no fluff)

1. End-to-end create launch
2. End-to-end invest
3. End-to-end finalize/refund
4. Strong validation and guardrails
5. Basic portfolio and transaction history
6. Testnet deployment + smoke tests

### Phase 2: Growth (Differentiate)

1. Whitelist and allocation caps
2. Vesting claims
3. Creator analytics and transparency panels
4. Reputation and risk scoring
5. Referral and loyalty loops

### Phase 3: Advanced (Moat)

1. Governance primitives
2. Dynamic sale mechanics
3. Anti-sybil and anti-bot hardening
4. Ecosystem APIs and partner rails

## 50-Feature Backlog

### Core and Safety

1. Whitelist per sale
2. Per-wallet min buy
3. Per-wallet max buy
4. Sale pause/resume
5. Sale soft-cap fail auto-refund
6. Claim window and vesting release endpoint
7. Claimable amount API
8. Sale state machine hard checks
9. Project owner-only privileged actions
10. Admin emergency stop

### Launch Experience

11. Multi-round sale setup
12. FCFS + lottery mode
13. Commit-reveal anti-sniping
14. Dynamic pricing curve mode
15. NFT-gated allowlist
16. Team allocation manager
17. Liquidity lock verification status
18. Launch templates
19. One-click clone launch
20. Draft mode before publishing

### Trust and Analytics

21. Public risk flags
22. Whale concentration indicator
23. Contract metadata diff viewer
24. Milestone-based treasury unlock
25. Treasury transparency dashboard
26. Creator reputation score
27. Launch quality score
28. Bot/sybil probability score
29. Community reports and moderation queue
30. Public audit checklist per project

### User Growth

31. Referral rewards
32. Loyalty points
33. Staking for allocation boosts
34. Badge system (SBT/NFT)
35. Portfolio performance page
36. Personalized launch recommendations
37. Push reminders for claim windows
38. Watchlist and alerts
39. Creator follow/subscribe
40. Telegram quest campaigns

### Platform and Integrations

41. Public data API
42. Webhook events for partners
43. Fiat on-ramp integration
44. Jetton payment support
45. Gasless meta-tx relay for selected actions
46. Regional compliance gates
47. Multi-language support
48. Advanced admin panel
49. Incident response runbooks in product UI
50. Ecosystem partner allocation module

## Build Order (Strict)

1. Finish MVP hard checks in API and contracts.
2. Add missing user-critical pages in miniapp (admin actions, claim UX, status visibility).
3. Add deterministic tests before adding Growth features.
4. Add Growth features only after MVP testnet soak.

## Definition of Done (Per Feature)

- API contract documented in OpenAPI.
- Server validation + auth + rate-limit rules complete.
- Mini app UI and error states complete.
- Tests added (unit + integration where relevant).
- Feature flag or rollout note included.
