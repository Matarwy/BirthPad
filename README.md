# BirthPad Monorepo

BirthPad is organized as a PNPM workspace monorepo with three core domains:

- `apps/miniapp` — Telegram Mini App frontend (React + TypeScript + Vite)
- `apps/api` — Node.js TypeScript backend API (Express modules)
- `contracts` — TON smart contracts (Tact)

## Workspace Layout

```text
.
├── apps/
│   ├── api/
│   └── miniapp/
├── contracts/
├── config/environments/
├── package.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Quickstart

```bash
pnpm install
pnpm dev
```

### Common commands

```bash
pnpm dev     # run all workspace dev scripts in parallel
pnpm build   # build all workspaces
pnpm lint    # lint all workspaces
pnpm test    # run tests in all workspaces
```

## Deployment environments

BirthPad supports three deployment environments with separate configs:

- `config/environments/devnet.json`
- `config/environments/testnet.json`
- `config/environments/mainnet.json`
- `config/contracts/addresses.json` (deployed contract address registry)

Runtime secrets are managed via environment variables; use template files:

- `.env.devnet.example`
- `.env.testnet.example`
- `.env.mainnet.example`

## Security

See `SECURITY.md` for controls, reporting process, and the incident-response checklist.

## Architecture

- Frontend ↔ Backend: `docs/architecture/app-api-diagram.md` (create and maintain with product docs)
- Backend ↔ Contracts: `docs/architecture/api-contracts-diagram.md` (create and maintain with protocol docs)

## Product Roadmap

- Delivery plan and 50-feature backlog: `docs/roadmap/launchpad-roadmap.md`
- MVP sprint tracker: `docs/roadmap/mvp-checklist.md`
