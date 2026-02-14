# Security Policy

## Supported environments

BirthPad uses isolated deployment environments:

- `devnet` for local development and integration checks
- `testnet` for pre-production validation
- `mainnet` for production

Environment configs are stored in `config/environments/*.json` and runtime secrets are loaded from environment variables (see `.env.*.example`). Never commit real secrets.

## Reporting a vulnerability

Please report suspected vulnerabilities privately to the maintainers and include:

1. Impact summary
2. Reproduction steps
3. Affected environment (`devnet`/`testnet`/`mainnet`)
4. Suggested mitigation

## Security controls

- Role-based controls for critical API paths (admin-only finalize/refund)
- Wallet signature authentication and anti-replay nonces
- Zod request validation for critical payloads
- In-memory rate limiting for critical endpoints
- Audit logging for critical actions (`audit/critical-actions.log`)
- Contract-level authorization for start/finalize pathways
- Timelock/vesting and liquidity lock metadata on sale configuration

## Incident response checklist

- [ ] Triage and classify severity (low/medium/high/critical)
- [ ] Freeze risky actions (pause finalize/refund endpoints if needed)
- [ ] Rotate impacted secrets (`WALLET_AUTH_SECRET`, deploy keys, API tokens)
- [ ] Identify affected project IDs, wallet addresses, and transaction hashes
- [ ] Export and preserve audit log evidence
- [ ] Patch and add regression tests
- [ ] Verify fix in `devnet`, then `testnet`, then `mainnet`
- [ ] Publish incident summary and timeline to stakeholders
- [ ] Conduct postmortem and backlog preventive controls
