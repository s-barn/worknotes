import { isNoteStatus, type Note } from '../domain/note';

export type ClientMessage =
  | { type: 'ready' }
  | { type: 'selectNote'; id: string }
  | { type: 'newNote' }
  | { type: 'saveNote'; note: Note }
  | { type: 'quickCapture'; content: string }
  | { type: 'openDaily' }
  | { type: 'createFromTemplate'; templateId: string; title: string }
  | { type: 'chooseRoot' };

function record(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function nonEmpty(value: unknown): value is string {
  return typeof value === 'string' && Boolean(value.trim());
}

function note(value: unknown): value is Note {
  if (!record(value)) {
    return false;
  }
  return nonEmpty(value.id)
    && typeof value.title === 'string'
    && typeof value.notebook === 'string'
    && isNoteStatus(value.status)
    && Array.isArray(value.tags)
    && value.tags.every(tag => typeof tag === 'string')
    && nonEmpty(value.created)
    && nonEmpty(value.updated)
    && typeof value.body === 'string'
    && nonEmpty(value.relativePath);
}

export function parseClientMessage(value: unknown): ClientMessage | undefined {
  if (!record(value) || !Object.hasOwn(value, 'type') || typeof value.type !== 'string') {
    return undefined;
  }
  switch (value.type) {
    case 'ready':
    case 'newNote':
    case 'openDaily':
    case 'chooseRoot':
      return { type: value.type };
    case 'selectNote':
      return nonEmpty(value.id) ? { type: value.type, id: value.id } : undefined;
    case 'quickCapture':
      return typeof value.content === 'string' ? { type: value.type, content: value.content } : undefined;
    case 'saveNote':
      return note(value.note) ? { type: value.type, note: { ...value.note, tags: [...value.note.tags] } } : undefined;
    case 'createFromTemplate':
      return nonEmpty(value.templateId) && nonEmpty(value.title)
        ? { type: value.type, templateId: value.templateId, title: value.title }
        : undefined;
    default:
      return undefined;
  }
}
