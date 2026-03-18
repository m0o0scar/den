import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { buildManagedProjectIconPath } from './project-icon-path.ts';

describe('buildManagedProjectIconPath', () => {
  it('changes the managed file path when icon bytes change', () => {
    const iconDir = '/tmp/project-icons';
    const projectPath = '/tmp/example-project';
    const extension = '.png';

    const firstPath = buildManagedProjectIconPath(
      iconDir,
      projectPath,
      extension,
      Buffer.from('first icon bytes'),
    );
    const secondPath = buildManagedProjectIconPath(
      iconDir,
      projectPath,
      extension,
      Buffer.from('second icon bytes'),
    );

    assert.notEqual(firstPath, secondPath);
    assert.match(firstPath, /^\/tmp\/project-icons\/[a-f0-9]{16}-[a-f0-9]{12}\.png$/);
    assert.match(secondPath, /^\/tmp\/project-icons\/[a-f0-9]{16}-[a-f0-9]{12}\.png$/);
  });

  it('keeps the managed file path stable for identical uploads', () => {
    const iconDir = '/tmp/project-icons';
    const projectPath = '/tmp/example-project';
    const extension = '.png';
    const fileBuffer = Buffer.from('same icon bytes');

    const firstPath = buildManagedProjectIconPath(iconDir, projectPath, extension, fileBuffer);
    const secondPath = buildManagedProjectIconPath(iconDir, projectPath, extension, fileBuffer);

    assert.equal(firstPath, secondPath);
  });
});
