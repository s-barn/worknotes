import assert from 'node:assert/strict';
import test from 'node:test';

import { writableConfigurationScope } from '../src/configuration';

test('writableConfigurationScope updates the highest-precedence configured scope', () => {
  assert.equal(writableConfigurationScope({ workspaceFolderValue: 'folder', workspaceValue: 'workspace' }), 'workspaceFolder');
  assert.equal(writableConfigurationScope({ workspaceValue: 'workspace', globalValue: 'global' }), 'workspace');
  assert.equal(writableConfigurationScope({ globalValue: 'global' }), 'global');
  assert.equal(writableConfigurationScope({}), 'global');
});
