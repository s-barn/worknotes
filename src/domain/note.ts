export const noteStatuses = ['inbox', 'active', 'archived'] as const;

export type NoteStatus = (typeof noteStatuses)[number];

export interface Note {
  id: string;
  title: string;
  notebook: string;
  status: NoteStatus;
  tags: string[];
  created: string;
  updated: string;
  body: string;
  relativePath?: string;
}

export interface NoteTask {
  noteId: string;
  text: string;
  completed: boolean;
  line: number;
}

export function isNoteStatus(value: unknown): value is NoteStatus {
  return typeof value === 'string' && noteStatuses.includes(value as NoteStatus);
}
