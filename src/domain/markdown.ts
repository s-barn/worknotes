import path from 'node:path';

import { parse, stringify } from 'yaml';

import { isNoteStatus, type Note, type NoteTask } from './note';

interface FrontmatterRecord {
  [key: string]: unknown;
}

function splitFrontmatter(markdown: string): { data: FrontmatterRecord; body: string } {
  const normalized = markdown.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { data: {}, body: normalized };
  }

  const closing = normalized.indexOf('\n---\n', 4);
  if (closing < 0) {
    return { data: {}, body: normalized };
  }

  const value = parse(normalized.slice(4, closing));
  return {
    data: value && typeof value === 'object' && !Array.isArray(value) ? value as FrontmatterRecord : {},
    body: normalized.slice(closing + 5)
  };
}

function text(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function isoDate(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback;
  }
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? fallback : date.toISOString();
}

export function parseNote(markdown: string, sourcePath: string): Note {
  const { data, body } = splitFrontmatter(markdown);
  const fallbackId = path.basename(sourcePath, path.extname(sourcePath));
  const id = text(data.id, fallbackId);
  const created = isoDate(data.created, new Date(0).toISOString());

  return {
    id,
    title: text(data.title, fallbackId),
    notebook: text(data.notebook, 'Notes'),
    status: isNoteStatus(data.status) ? data.status : 'active',
    tags: Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())).map(tag => tag.trim())
      : [],
    created,
    updated: isoDate(data.updated, created),
    body
  };
}

export function serializeNote(note: Note): string {
  const frontmatter = stringify({
    id: note.id,
    title: note.title,
    notebook: note.notebook,
    status: note.status,
    tags: note.tags,
    created: note.created,
    updated: note.updated
  }).trimEnd();

  return `---\n${frontmatter}\n---\n${note.body}`;
}

export function extractTasks(note: Note): NoteTask[] {
  const tasks: NoteTask[] = [];
  note.body.replace(/\r\n/g, '\n').split('\n').forEach((line, index) => {
    const match = line.match(/^\s*[-*+]\s+\[([ xX])]\s+(.+?)\s*$/);
    if (match) {
      tasks.push({
        noteId: note.id,
        text: match[2],
        completed: match[1].toLowerCase() === 'x',
        line: index + 1
      });
    }
  });
  return tasks;
}
