import { parse } from 'yaml';

export interface NoteTemplate {
  id: string;
  title: string;
  notebook: string;
  tags: string[];
  body: string;
}

function splitTemplate(markdown: string): { data: Record<string, unknown>; body: string } {
  const normalized = markdown.replace(/\r\n/g, '\n');
  if (!normalized.startsWith('---\n')) {
    return { data: {}, body: normalized };
  }
  const closing = normalized.indexOf('\n---\n', 4);
  if (closing < 0) {
    return { data: {}, body: normalized };
  }
  try {
    const value = parse(normalized.slice(4, closing));
    return {
      data: value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {},
      body: normalized.slice(closing + 5)
    };
  } catch {
    return { data: {}, body: normalized };
  }
}

export function parseTemplate(id: string, markdown: string): NoteTemplate {
  const { data, body } = splitTemplate(markdown);
  return {
    id,
    title: typeof data.title === 'string' && data.title.trim() ? data.title.trim() : id,
    notebook: typeof data.notebook === 'string' && data.notebook.trim() ? data.notebook.trim() : 'Notes',
    tags: Array.isArray(data.tags)
      ? data.tags.filter((tag): tag is string => typeof tag === 'string' && Boolean(tag.trim())).map(tag => tag.trim())
      : [],
    body
  };
}

function localDateParts(date: Date): { date: string; time: string } {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hour = String(date.getHours()).padStart(2, '0');
  const minute = String(date.getMinutes()).padStart(2, '0');
  return { date: `${year}-${month}-${day}`, time: `${hour}:${minute}` };
}

export function expandTemplate(template: NoteTemplate, title: string, date: Date): string {
  const parts = localDateParts(date);
  return template.body
    .replaceAll('{{title}}', title)
    .replaceAll('{{date}}', parts.date)
    .replaceAll('{{time}}', parts.time);
}
