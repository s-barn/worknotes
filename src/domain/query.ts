import { extractTasks } from './markdown';
import type { Note, NoteStatus } from './note';

export interface NoteQuery {
  search?: string;
  notebook?: string;
  status?: NoteStatus;
  tag?: string;
  tasksOnly?: boolean;
}

export function hasActionableTasks(note: Note): boolean {
  return extractTasks(note).length > 0;
}

function same(left: string, right: string): boolean {
  return left.localeCompare(right, undefined, { sensitivity: 'accent' }) === 0;
}

export function filterNotes(notes: readonly Note[], query: NoteQuery): Note[] {
  const search = query.search?.trim().toLocaleLowerCase();

  return notes
    .filter(note => {
      if (search) {
        const haystack = [note.title, note.notebook, note.body, ...note.tags].join('\n').toLocaleLowerCase();
        if (!haystack.includes(search)) {
          return false;
        }
      }
      if (query.notebook && !same(note.notebook, query.notebook)) {
        return false;
      }
      if (query.status && note.status !== query.status) {
        return false;
      }
      if (query.tag && !note.tags.some(tag => same(tag, query.tag!))) {
        return false;
      }
      if (query.tasksOnly && !hasActionableTasks(note)) {
        return false;
      }
      return true;
    })
    .sort((left, right) => right.updated.localeCompare(left.updated));
}
