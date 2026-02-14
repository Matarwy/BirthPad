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

## Architecture

- Frontend ↔ Backend: `docs/architecture/app-api-diagram.md` (create and maintain with product docs)
- Backend ↔ Contracts: `docs/architecture/api-contracts-diagram.md` (create and maintain with protocol docs)
