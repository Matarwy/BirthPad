import { describe, expect, it } from 'vitest';

interface CreateProjectInput {
  projectOwner: string;
}

class LaunchFactoryModel {
  private nextProjectId = 1;
  private readonly projects = new Map<number, string>();

  constructor(
    private readonly owner: string,
    private readonly admin: string,
  ) {}

  createProject(caller: string, input: CreateProjectInput) {
    if (caller !== this.owner && caller !== this.admin) throw new Error('unauthorized');

    const projectId = this.nextProjectId++;
    const saleAddress = `sale_${projectId}_${input.projectOwner}`;
    this.projects.set(projectId, saleAddress);
    return { projectId, saleAddress };
  }

  pauseProject(caller: string, projectId: number) {
    if (caller !== this.owner && caller !== this.admin) throw new Error('unauthorized');
    const sale = this.projects.get(projectId);
    if (!sale) throw new Error('missing');
    return { sale, action: 'pause' as const };
  }

  resumeProject(caller: string, projectId: number) {
    if (caller !== this.owner && caller !== this.admin) throw new Error('unauthorized');
    const sale = this.projects.get(projectId);
    if (!sale) throw new Error('missing');
    return { sale, action: 'resume' as const };
  }

  finalizeProject(caller: string, projectId: number) {
    if (caller !== this.owner && caller !== this.admin) throw new Error('unauthorized');
    const sale = this.projects.get(projectId);
    if (!sale) throw new Error('missing');
    return { sale, action: 'finalize' as const };
  }
}

describe('LaunchFactory controls', () => {
  it('allows owner/admin to create projects', () => {
    const factory = new LaunchFactoryModel('owner', 'admin');

    const first = factory.createProject('owner', { projectOwner: 'founder_1' });
    const second = factory.createProject('admin', { projectOwner: 'founder_2' });

    expect(first.projectId).toBe(1);
    expect(second.projectId).toBe(2);
    expect(first.saleAddress).not.toBe(second.saleAddress);
  });

  it('rejects unauthorized project creation', () => {
    const factory = new LaunchFactoryModel('owner', 'admin');
    expect(() => factory.createProject('attacker', { projectOwner: 'founder_1' })).toThrow(
      /unauthorized/,
    );
  });

  it('allows owner/admin control actions on existing projects', () => {
    const factory = new LaunchFactoryModel('owner', 'admin');
    const created = factory.createProject('owner', { projectOwner: 'founder_1' });

    expect(factory.pauseProject('owner', created.projectId)).toEqual({
      sale: created.saleAddress,
      action: 'pause',
    });
    expect(factory.resumeProject('admin', created.projectId)).toEqual({
      sale: created.saleAddress,
      action: 'resume',
    });
    expect(factory.finalizeProject('admin', created.projectId)).toEqual({
      sale: created.saleAddress,
      action: 'finalize',
    });
  });

  it('rejects unauthorized control actions', () => {
    const factory = new LaunchFactoryModel('owner', 'admin');
    const created = factory.createProject('owner', { projectOwner: 'founder_1' });

    expect(() => factory.pauseProject('attacker', created.projectId)).toThrow(/unauthorized/);
    expect(() => factory.resumeProject('attacker', created.projectId)).toThrow(/unauthorized/);
    expect(() => factory.finalizeProject('attacker', created.projectId)).toThrow(/unauthorized/);
  });

  it('rejects control actions for missing project', () => {
    const factory = new LaunchFactoryModel('owner', 'admin');
    expect(() => factory.pauseProject('owner', 999)).toThrow(/missing/);
    expect(() => factory.resumeProject('owner', 999)).toThrow(/missing/);
    expect(() => factory.finalizeProject('owner', 999)).toThrow(/missing/);
  });
});
