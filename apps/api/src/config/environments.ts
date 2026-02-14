import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type DeploymentEnv = 'devnet' | 'testnet' | 'mainnet';

const env = (process.env.DEPLOY_ENV ?? 'devnet').toLowerCase();

const isDeploymentEnv = (value: string): value is DeploymentEnv =>
  value === 'devnet' || value === 'testnet' || value === 'mainnet';

export const deploymentEnv: DeploymentEnv = isDeploymentEnv(env) ? env : 'devnet';

export const isProdLikeEnv = deploymentEnv === 'mainnet';

interface EnvContractsConfig {
  launchFactory?: string;
  projectSaleTemplate?: string;
}

interface EnvConfigFile {
  name: DeploymentEnv;
  apiBaseUrl?: string;
  tonNetwork?: string;
  contracts?: EnvContractsConfig;
  features?: {
    strictRateLimit?: boolean;
    auditLogging?: boolean;
    opsAnomalyThresholds?: {
      bucketHours?: number;
      refundWarningCount?: number;
      refundCriticalCount?: number;
      buyDropoffLookbackHours?: number;
    };
  };
}

interface ContractsRegistryEntry {
  launchFactory?: string;
  projectSaleTemplate?: string;
  deployedAt?: string;
}

type ContractsRegistryFile = Record<DeploymentEnv, ContractsRegistryEntry>;

const readJsonFile = <T>(candidates: string[]): T | undefined => {
  for (const path of candidates) {
    if (!existsSync(path)) continue;
    try {
      return JSON.parse(readFileSync(path, 'utf8')) as T;
    } catch {
      continue;
    }
  }
  return undefined;
};

const envConfigCandidates = [
  resolve(process.cwd(), `config/environments/${deploymentEnv}.json`),
  resolve(process.cwd(), `../../config/environments/${deploymentEnv}.json`),
];

const contractsRegistryCandidates = [
  resolve(process.cwd(), 'config/contracts/addresses.json'),
  resolve(process.cwd(), '../../config/contracts/addresses.json'),
];

const envConfig = readJsonFile<EnvConfigFile>(envConfigCandidates);
const contractsRegistry = readJsonFile<ContractsRegistryFile>(contractsRegistryCandidates);
const registryEntry = contractsRegistry?.[deploymentEnv];
const envContracts = envConfig?.contracts ?? {};

export const deploymentContracts = {
  launchFactory: registryEntry?.launchFactory || envContracts.launchFactory || '',
  projectSaleTemplate: registryEntry?.projectSaleTemplate || envContracts.projectSaleTemplate || '',
  deployedAt: registryEntry?.deployedAt || '',
};

export const deploymentConfig = {
  env: deploymentEnv,
  tonNetwork: envConfig?.tonNetwork ?? deploymentEnv,
  apiBaseUrl: envConfig?.apiBaseUrl ?? '',
  contracts: deploymentContracts,
};

const normalize = (value?: string) => (value ?? '').trim();

const compareField = (
  field: keyof Pick<EnvContractsConfig, 'launchFactory' | 'projectSaleTemplate'>,
) => {
  const envValue = normalize(envContracts[field]);
  const registryValue = normalize(registryEntry?.[field]);
  return {
    field,
    envValue,
    registryValue,
    matches: envValue === registryValue,
  };
};

export const deploymentDrift = {
  hasRegistry: Boolean(registryEntry),
  checks: [compareField('launchFactory'), compareField('projectSaleTemplate')],
};

export const deploymentHealth = {
  hasLaunchFactory: Boolean(deploymentContracts.launchFactory),
  hasProjectSaleTemplate: Boolean(deploymentContracts.projectSaleTemplate),
  driftDetected: deploymentDrift.checks.some((check) => !check.matches),
};

const thresholds = envConfig?.features?.opsAnomalyThresholds;

export const opsAnomalyThresholds = {
  bucketHours: Math.max(6, Math.min(48, Number(thresholds?.bucketHours ?? 12))),
  refundWarningCount: Math.max(1, Number(thresholds?.refundWarningCount ?? 3)),
  refundCriticalCount: Math.max(
    Number(thresholds?.refundWarningCount ?? 3),
    Number(thresholds?.refundCriticalCount ?? 6),
  ),
  buyDropoffLookbackHours: Math.max(
    1,
    Math.min(12, Number(thresholds?.buyDropoffLookbackHours ?? 3)),
  ),
};
