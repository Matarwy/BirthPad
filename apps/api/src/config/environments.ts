export type DeploymentEnv = 'devnet' | 'testnet' | 'mainnet';

const env = (process.env.DEPLOY_ENV ?? 'devnet').toLowerCase();

const isDeploymentEnv = (value: string): value is DeploymentEnv => value === 'devnet' || value === 'testnet' || value === 'mainnet';

export const deploymentEnv: DeploymentEnv = isDeploymentEnv(env) ? env : 'devnet';

export const isProdLikeEnv = deploymentEnv === 'mainnet';
