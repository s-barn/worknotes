import assert from 'node:assert/strict';
import test from 'node:test';

import { parseClientMessage } from '../src/webview/messages';

test('parseClientMessage accepts known commands with validated fields', () => {
  assert.deepEqual(parseClientMessage({ type: 'selectNote', id: 'abc' }), { type: 'selectNote', id: 'abc' });
  assert.deepEqual(parseClientMessage({ type: 'quickCapture', content: 'New idea' }), { type: 'quickCapture', content: 'New idea' });
  assert.deepEqual(parseClientMessage({ type: 'createFromTemplate', templateId: 'meeting', title: 'Weekly' }), {
    type: 'createFromTemplate',
    templateId: 'meeting',
    title: 'Weekly'
  });
});

test('parseClientMessage rejects unknown, incomplete, and prototype-bearing messages', () => {
  assert.equal(parseClientMessage({ type: 'deleteNote', id: 'abc' }), undefined);
  assert.equal(parseClientMessage({ type: 'selectNote', id: '' }), undefined);
  assert.equal(parseClientMessage({ type: 'quickCapture', content: 12 }), undefined);
  assert.equal(parseClientMessage(Object.create({ type: 'ready' })), undefined);
});

test('parseClientMessage validates complete editable note payloads', () => {
  const message = parseClientMessage({
    type: 'saveNote',
    note: {
      id: 'abc',
      title: 'Title',
      notebook: 'Notes',
      status: 'active',
      tags: ['one'],
      created: '2026-10-27T12:00:00.000Z',
      updated: '2026-10-27T12:00:00.000Z',
      body: '# Body',
      relativePath: 'abc.md'
    }
  });

  assert.equal(message?.type, 'saveNote');
  assert.equal(message?.type === 'saveNote' ? message.note.title : '', 'Title');
  assert.equal(parseClientMessage({ type: 'saveNote', note: { id: '../escape' } }), undefined);
});
