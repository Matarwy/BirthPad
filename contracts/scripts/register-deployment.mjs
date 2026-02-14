#!/usr/bin/env node

import { readFile, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const VALID_ENVS = new Set(['devnet', 'testnet', 'mainnet']);

const parseArgs = (argv) => {
  const flags = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (!token.startsWith('--')) continue;
    const key = token.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      flags[key] = 'true';
      continue;
    }
    flags[key] = next;
    i += 1;
  }
  return flags;
};

const isTonAddress = (value) => /^(EQ|UQ)[A-Za-z0-9_-]{20,}$/.test(value);

const usage = () => {
  console.log(
    [
      'Usage:',
      '  node scripts/register-deployment.mjs --env <devnet|testnet|mainnet> --launch-factory <TON_ADDRESS> [--project-sale-template <TON_ADDRESS>]',
      '',
      'Example:',
      '  node scripts/register-deployment.mjs --env testnet --launch-factory EQC... --project-sale-template EQD...',
    ].join('\n'),
  );
};

const main = async () => {
  const flags = parseArgs(process.argv.slice(2));
  if (flags.help === 'true') {
    usage();
    return;
  }

  const env = (flags.env ?? '').toLowerCase();
  const launchFactory = flags['launch-factory'] ?? '';
  const projectSaleTemplate = flags['project-sale-template'] ?? '';

  if (!VALID_ENVS.has(env)) {
    throw new Error('Invalid or missing --env');
  }
  if (!isTonAddress(launchFactory)) {
    throw new Error('Invalid or missing --launch-factory TON address');
  }
  if (projectSaleTemplate && !isTonAddress(projectSaleTemplate)) {
    throw new Error('Invalid --project-sale-template TON address');
  }

  const repoRoot = resolve(new URL('..', import.meta.url).pathname, '..');
  const registryPath = resolve(repoRoot, 'config/contracts/addresses.json');
  const envConfigPath = resolve(repoRoot, `config/environments/${env}.json`);

  const [registryRaw, envRaw] = await Promise.all([
    readFile(registryPath, 'utf8'),
    readFile(envConfigPath, 'utf8'),
  ]);

  const registry = JSON.parse(registryRaw);
  const envConfig = JSON.parse(envRaw);
  const deployedAt = new Date().toISOString();

  registry[env] = {
    launchFactory,
    projectSaleTemplate,
    deployedAt,
  };

  envConfig.contracts = {
    ...(envConfig.contracts ?? {}),
    launchFactory,
    ...(projectSaleTemplate ? { projectSaleTemplate } : {}),
  };

  await Promise.all([
    writeFile(registryPath, `${JSON.stringify(registry, null, 2)}\n`, 'utf8'),
    writeFile(envConfigPath, `${JSON.stringify(envConfig, null, 2)}\n`, 'utf8'),
  ]);

  console.log(
    JSON.stringify(
      {
        status: 'ok',
        env,
        launchFactory,
        projectSaleTemplate,
        deployedAt,
        updated: ['config/contracts/addresses.json', `config/environments/${env}.json`],
      },
      null,
      2,
    ),
  );
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  usage();
  process.exit(1);
});
