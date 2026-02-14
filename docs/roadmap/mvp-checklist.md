# MVP Execution Checklist

## Sprint 1 (Foundation Hardening)

### API

- [ ] Enforce sale time checks (`startsAt`, `endsAt`) on buy/finalize/refund.
- [ ] Enforce sale/project state checks on buy/finalize/refund.
- [ ] Add per-wallet min/max buy validation.
- [ ] Add optional whitelist check in buy flow.
- [ ] Add owner/admin authorization boundary for finalize and pause flows.
- [ ] Extend OpenAPI docs for all new fields and error codes.

### Contracts

- [ ] Mirror hard checks in Tact (caps, timing, states).
- [ ] Add pause/finalize/refund actions with strict sender checks.
- [ ] Add claim schedule storage and claim function skeleton.
- [ ] Add contract tests for invalid transitions and edge cases.

### Mini App

- [ ] Create admin/founder action panel (pause/finalize/refund controls).
- [ ] Add buy form validation (min/max/caps).
- [ ] Add clearer transaction status and error states.
- [ ] Add launch state badge (upcoming/active/finalized/refunded/paused).

### Test and CI

- [ ] Add integration test for create -> buy -> finalize.
- [ ] Add integration test for soft-cap fail -> refund.
- [ ] Add integration test for unauthorized admin action rejection.
- [ ] Ensure `pnpm test` passes for all workspaces in CI.

## Sprint 2 (MVP Completion)

### API

- [ ] Add claim endpoint + claimable balance endpoint.
- [ ] Add project-level analytics summary endpoint.
- [ ] Add webhook-ready event payload format.

### Mini App

- [ ] Add claim page in portfolio flow.
- [ ] Add creator analytics panel.
- [ ] Add watchlist and reminders UX baseline.

### Contracts

- [ ] Finalize claim logic and tests.
- [ ] Add event emissions for all lifecycle actions.

## Sprint 3 (Testnet Readiness)

- [ ] Deploy contracts to TON testnet.
- [ ] Run end-to-end smoke scripts against testnet.
- [ ] Publish testnet config and operations notes.
- [ ] Run security checklist from `SECURITY.md`.

## Non-Negotiable Release Gates

- [ ] No critical lifecycle path without tests.
- [ ] No privileged action without auth + audit log.
- [ ] No new feature shipped without rollback strategy.
