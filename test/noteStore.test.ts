import assert from 'node:assert/strict';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';

import { NoteStore } from '../src/storage/noteStore';

const fixedDate = new Date(2026, 9, 27, 13, 45, 0);

async function withStore(run: (store: NoteStore, root: string) => Promise<void>): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'worknotes-'));
  const store = new NoteStore(root, () => fixedDate, () => 'fixed-id');
  try {
    await store.initialize();
    await run(store, root);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}

test('initialize creates the portable folder structure and starter templates', async () => {
  await withStore(async (store, root) => {
    const templates = await store.listTemplates();

    assert.deepEqual(templates.map(template => template.id), ['blank', 'meeting']);
    assert.equal(await readFile(path.join(root, 'templates', 'blank.md'), 'utf8').then(Boolean), true);
  });
});

test('quickCapture creates an inbox note that list and save round-trip', async () => {
  await withStore(async store => {
    const captured = await store.quickCapture('Follow up with the team\n\nInclude the build link.');
    assert.equal(captured.title, 'Follow up with the team');
    assert.equal(captured.notebook, 'Inbox');
    assert.equal(captured.status, 'inbox');

    const listed = await store.list();
    assert.deepEqual(listed.notes.map(note => note.id), ['fixed-id']);

    captured.tags = ['follow-up'];
    captured.body += '\n- [ ] Send reply\n';
    const saved = await store.save(captured);
    assert.deepEqual(saved.tags, ['follow-up']);

    const loaded = await store.read('fixed-id');
    assert.match(loaded.body, /Send reply/);
    assert.deepEqual(loaded.tags, ['follow-up']);
  });
});

test('openDaily is idempotent for the same local calendar date', async () => {
  await withStore(async store => {
    const first = await store.openDaily();
    const second = await store.openDaily();
    const listed = await store.list();

    assert.equal(first.id, 'daily-2026-10-27');
    assert.equal(second.id, first.id);
    assert.equal(first.relativePath, 'daily/2026-10-27.md');
    assert.equal(listed.notes.length, 1);
  });
});

test('createFromTemplate expands title, date, and time variables', async () => {
  await withStore(async (store, root) => {
    await writeFile(
      path.join(root, 'templates', 'custom.md'),
      '---\nnotebook: Projects\ntags:\n  - template\n---\n# {{title}}\n\n{{date}} at {{time}}\n',
      'utf8'
    );

    const created = await store.createFromTemplate('custom', 'Iteration Review');

    assert.equal(created.title, 'Iteration Review');
    assert.equal(created.notebook, 'Projects');
    assert.deepEqual(created.tags, ['template']);
    assert.equal(created.body, '# Iteration Review\n\n2026-10-27 at 13:45\n');
  });
});

test('nested templates retain their relative identifier when listed and created', async () => {
  await withStore(async (store, root) => {
    const teamDirectory = path.join(root, 'templates', 'team');
    await mkdir(teamDirectory, { recursive: true });
    await writeFile(path.join(teamDirectory, 'retro.md'), '# {{title}} team retrospective\n', 'utf8');

    const templates = await store.listTemplates();
    const nested = templates.find(template => template.id === 'team/retro');
    assert.ok(nested);

    const created = await store.createFromTemplate('team/retro', 'Platform');
    assert.equal(created.body, '# Platform team retrospective\n');
  });
});

test('save rejects a note path that escapes the notes directory', async () => {
  await withStore(async store => {
    const note = await store.quickCapture('Safe note');
    note.relativePath = '../outside.md';

    await assert.rejects(() => store.save(note), /outside the notes root/i);
  });
});

test('list reports invalid YAML without hiding valid notes', async () => {
  await withStore(async (store, root) => {
    await store.quickCapture('Valid note');
    await writeFile(path.join(root, 'notes', 'broken.md'), '---\ntags: [\n---\nBroken body', 'utf8');

    const result = await store.list();

    assert.deepEqual(result.notes.map(note => note.title), ['Valid note']);
    assert.equal(result.warnings.length, 1);
    assert.match(result.warnings[0], /broken\.md/i);
  });
});
