import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import { mkdtemp, mkdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

type ConfigModule = typeof import('./config.ts');
type ProjectServiceModule = typeof import('./project-service.ts');
type StoreModule = typeof import('../../lib/store.ts');

let tempHome = '';
let previousHome = '';
let previousUserProfile = '';
let configModule: ConfigModule;
let projectServiceModule: ProjectServiceModule;
let storeModule: StoreModule;

async function waitFor(predicate: () => Promise<boolean>, timeoutMs = 5000): Promise<void> {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    if (await predicate()) return;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error('Timed out waiting for condition.');
}

before(async () => {
  tempHome = await mkdtemp(path.join(os.tmpdir(), 'palx-project-service-test-'));
  previousHome = process.env.HOME || '';
  previousUserProfile = process.env.USERPROFILE || '';
  process.env.HOME = tempHome;
  process.env.USERPROFILE = tempHome;

  configModule = await import('./config.ts');
  projectServiceModule = await import('./project-service.ts');
  storeModule = await import('../../lib/store.ts');
});

after(async () => {
  process.env.HOME = previousHome;
  process.env.USERPROFILE = previousUserProfile;
  if (tempHome) {
    await rm(tempHome, { recursive: true, force: true });
  }
});

describe('project service manager', () => {
  it('clears persisted service output after stop and restart', async () => {
    const projectRoot = path.join(tempHome, 'service-project');
    const counterPath = path.join(projectRoot, 'service-run-count.txt');
    const startScript = [
      'const fs=require("node:fs");',
      `const countPath=${JSON.stringify(counterPath)};`,
      'const current=fs.existsSync(countPath)?Number(fs.readFileSync(countPath, "utf8")):0;',
      'const next=current+1;',
      'fs.writeFileSync(countPath, String(next));',
      'console.log("service boot "+next);',
      'setInterval(() => console.log("tick "+next), 200);',
    ].join(' ');
    await mkdir(projectRoot, { recursive: true });

    const project = storeModule.addProject({
      name: 'Service Project',
      folderPaths: [projectRoot],
    });

    await configModule.updateProjectSettings(project.id, {
      serviceStartCommand: `node -e '${startScript}'`,
      serviceStopCommand: 'node -e "console.log(\'service stop command\')"',
    });

    const startResult = await projectServiceModule.startProjectService(project.id);
    assert.equal(startResult.success, true);
    assert.equal(startResult.status?.running, true);

    await waitFor(async () => {
      const logResult = await projectServiceModule.getProjectServiceLog(project.id);
      return Boolean(logResult.output?.includes('service boot 1'));
    });

    const statuses = await projectServiceModule.getProjectServiceStatuses([project.id]);
    assert.equal(statuses[project.id]?.configured, true);
    assert.equal(statuses[project.id]?.running, true);

    const stopResult = await projectServiceModule.stopProjectService(project.id);
    assert.equal(stopResult.success, true);
    assert.equal(stopResult.status?.running, false);

    await waitFor(async () => {
      const logResult = await projectServiceModule.getProjectServiceLog(project.id);
      return logResult.output === '';
    });

    const stoppedLog = await projectServiceModule.getProjectServiceLog(project.id);
    assert.equal(stoppedLog.output, '');

    const restartResult = await projectServiceModule.restartProjectService(project.id);
    assert.equal(restartResult.success, true);
    assert.equal(restartResult.status?.running, true);

    await waitFor(async () => {
      const logResult = await projectServiceModule.getProjectServiceLog(project.id);
      return Boolean(logResult.output?.includes('service boot 2'));
    });

    const restartedLog = await projectServiceModule.getProjectServiceLog(project.id);
    assert.equal(restartedLog.output?.includes('service boot 1'), false);
    assert.equal(restartedLog.output?.includes('service stop command'), false);
    assert.equal(restartedLog.output?.includes('service boot 2'), true);

    const finalStopResult = await projectServiceModule.stopProjectService(project.id);
    assert.equal(finalStopResult.success, true);

    const finalStatuses = await projectServiceModule.getProjectServiceStatuses([project.id]);
    assert.equal(finalStatuses[project.id]?.running, false);
  });
});
