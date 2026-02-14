import { TtlCache } from '../../cache/ttl-cache';
import { store } from '../../db/store';

const listCache = new TtlCache<unknown[]>(30_000);
const progressCache = new TtlCache<{ raised: string; hardCap: string; progress: number }>(15_000);

const asNum = (value: string) => Number(value);

export const getProjects = (kind: 'trending' | 'new' | 'all') => {
  const key = `projects:${kind}`;
  const cached = listCache.get(key);
  if (cached) return cached;

  const projects = [...store.projects.values()].map((project) => {
    const saleId = store.salesByProject.get(project.id);
    const sale = saleId ? store.sales.get(saleId) : undefined;
    return { ...project, raisedAmount: sale?.raisedAmount ?? '0' };
  });

  if (kind === 'trending') {
    projects.sort((a, b) => Number(b.raisedAmount) - Number(a.raisedAmount));
  } else if (kind === 'new') {
    projects.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
  }

  listCache.set(key, projects);
  return projects;
};

export const getProjectProgress = (projectId: string) => {
  const key = `progress:${projectId}`;
  const cached = progressCache.get(key);
  if (cached) return cached;

  const project = store.projects.get(projectId);
  const saleId = store.salesByProject.get(projectId);
  const sale = saleId ? store.sales.get(saleId) : undefined;

  if (!project || !sale) {
    return undefined;
  }

  const raised = sale.raisedAmount;
  const hardCap = project.hardCap;
  const progress = Math.min(100, (asNum(raised) / Math.max(1, asNum(hardCap))) * 100);
  const computed = { raised, hardCap, progress };
  progressCache.set(key, computed);
  return computed;
};

export const invalidateProjectCache = (projectId?: string) => {
  listCache.clear();
  if (projectId) {
    progressCache.delete(`progress:${projectId}`);
  } else {
    progressCache.clear();
  }
};
