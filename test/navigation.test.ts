import assert from 'node:assert/strict';
import path from 'node:path';
import test from 'node:test';

interface NavigationAction {
  type: string;
  values?: Record<string, unknown>;
}

interface NavigationPlan {
  saveFirst: boolean;
  pendingAction?: NavigationAction;
  dispatchAction?: NavigationAction;
}

const navigation = require(path.resolve(__dirname, '../../media/navigation.js')) as {
  plan(action: NavigationAction, dirty: boolean): NavigationPlan;
};

test('navigation guard saves dirty edits before dispatching the requested action', () => {
  const action = { type: 'selectNote', values: { id: 'next-note' } };

  assert.deepEqual(navigation.plan(action, true), {
    saveFirst: true,
    pendingAction: action
  });
  assert.deepEqual(navigation.plan(action, false), {
    saveFirst: false,
    dispatchAction: action
  });
});
