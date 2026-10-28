import assert from 'node:assert/strict';
import test from 'node:test';

import { extractTasks, parseNote, serializeNote } from '../src/domain/markdown';
import { filterNotes, hasActionableTasks } from '../src/domain/query';
import type { Note } from '../src/domain/note';

const note: Note = {
  id: 'project-plan',
  title: 'Project Plan',
  notebook: 'WorkNotes',
  status: 'active',
  tags: ['planning', 'vscode'],
  created: '2026-10-27T13:00:00.000Z',
  updated: '2026-10-27T14:00:00.000Z',
  body: '## Tasks\n\n- [ ] Ship Iteration 1\n- [x] Agree on scope\n'
};

test('serializeNote and parseNote preserve a portable note', () => {
  const markdown = serializeNote(note);
  const parsed = parseNote(markdown, 'project-plan.md');

  assert.deepEqual(parsed, note);
  assert.match(markdown, /^---\nid: project-plan/m);
});

test('parseNote applies safe defaults when optional frontmatter fields are malformed', () => {
  const parsed = parseNote('---\ntitle: 42\ntags: bad\nstatus: unknown\n---\nBody', 'fallback-name.md');

  assert.equal(parsed.id, 'fallback-name');
  assert.equal(parsed.title, 'fallback-name');
  assert.equal(parsed.status, 'active');
  assert.deepEqual(parsed.tags, []);
  assert.equal(parsed.body, 'Body');
});

test('extractTasks returns checked and unchecked Markdown tasks with line numbers', () => {
  assert.deepEqual(extractTasks(note), [
    { noteId: 'project-plan', text: 'Ship Iteration 1', completed: false, line: 3 },
    { noteId: 'project-plan', text: 'Agree on scope', completed: true, line: 4 }
  ]);
});

test('filterNotes combines case-insensitive search, notebook, status, tag, and task filters', () => {
  const other: Note = {
    ...note,
    id: 'other',
    title: 'Archived Reference',
    notebook: 'Reference',
    status: 'archived',
    tags: ['vscode'],
    body: 'No tasks here',
    updated: '2026-10-27T12:00:00.000Z'
  };

  const result = filterNotes([other, note], {
    search: 'SHIP iteration',
    notebook: 'WorkNotes',
    status: 'active',
    tag: 'PLANNING',
    tasksOnly: true
  });

  assert.deepEqual(result.map(item => item.id), ['project-plan']);
});

test('hasActionableTasks ignores empty checkbox placeholders', () => {
  assert.equal(hasActionableTasks({ ...note, body: '- [ ] \n\n## Notes\n' }), false);
  assert.equal(hasActionableTasks({ ...note, body: '- [ ] Write release notes\n' }), true);
});
