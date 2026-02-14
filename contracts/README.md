# BirthPad TON Contracts

This package contains TON smart contracts authored in Tact.

## Lifecycle Features

- `ProjectSale` supports `StartSale`, `Pause`, `Resume`, `Buy`, `Finalize`, `Refund`, and `Claim`.
- Claim flow is vesting-aware via `teamVestingEnabled`, `vestingCliffSeconds`, and `vestingDurationSeconds`.
- Getter methods include `state`, `raised`, `contributionOf`, `claimedOf`, `claimableOf`, and `lockInfo`.
- `LaunchFactory` supports `CreateProject`, `PauseProject`, `ResumeProject`, and `FinalizeProject` for owner/admin project controls.

## Scripts

- `pnpm build` compiles Tact contracts to the `build/` directory.
- `pnpm test` runs local contract package tests.
- `pnpm deploy:devnet|deploy:testnet|deploy:mainnet` builds contracts and optionally registers deployment addresses.
- `pnpm register:deployment -- --env <env> --launch-factory <TON_ADDRESS> [--project-sale-template <TON_ADDRESS>]` writes addresses to shared config.

## Address Registry

- Shared registry path: `config/contracts/addresses.json`.
- Runtime env contracts config path: `config/environments/<env>.json`.
- Registration script validates TON-style addresses before writing.
