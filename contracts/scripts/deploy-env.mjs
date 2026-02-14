#!/usr/bin/env node

import { spawn } from 'node:child_process';

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

const run = (command, args) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`${command} ${args.join(' ')} failed with code ${code}`));
    });
  });

const usage = () => {
  console.log(
    [
      'Usage:',
      '  node scripts/deploy-env.mjs --env <devnet|testnet|mainnet> [--launch-factory <TON_ADDRESS>] [--project-sale-template <TON_ADDRESS>]',
      '',
      'Notes:',
      '  - This script compiles contracts and optionally registers deployed addresses.',
      '  - Actual chain deployment transaction is handled by your wallet/deployer flow.',
    ].join('\n'),
  );
};

const main = async () => {
  const flags = parseArgs(process.argv.slice(2));
  const env = (flags.env ?? '').toLowerCase();
  if (!env) {
    usage();
    throw new Error('Missing --env');
  }

  console.log(`[deploy] Building contracts for ${env}...`);
  await run('pnpm', ['run', 'build']);

  const launchFactory = flags['launch-factory'] ?? process.env.LAUNCH_FACTORY_ADDRESS;
  const projectSaleTemplate =
    flags['project-sale-template'] ?? process.env.PROJECT_SALE_TEMPLATE_ADDRESS;

  if (!launchFactory) {
    console.log(
      '[deploy] Build complete. No contract addresses provided, skipping registry update.',
    );
    console.log('[deploy] To register deployment:');
    console.log(
      `pnpm run register:deployment -- --env ${env} --launch-factory <TON_ADDRESS> [--project-sale-template <TON_ADDRESS>]`,
    );
    return;
  }

  console.log('[deploy] Registering deployment addresses...');
  const registerArgs = [
    'run',
    'register:deployment',
    '--',
    '--env',
    env,
    '--launch-factory',
    launchFactory,
  ];
  if (projectSaleTemplate) {
    registerArgs.push('--project-sale-template', projectSaleTemplate);
  }
  await run('pnpm', registerArgs);

  console.log('[deploy] Done');
};

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
