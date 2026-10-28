import { randomUUID } from 'node:crypto';
import { access, mkdir, readFile, readdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { parseNote, serializeNote } from '../domain/markdown';
import type { Note, NoteStatus } from '../domain/note';
import { expandTemplate, parseTemplate, type NoteTemplate } from '../domain/templates';

export interface NoteListResult {
  notes: Note[];
  warnings: string[];
}

export interface CreateNoteInput {
  title: string;
  notebook?: string;
  status?: NoteStatus;
  tags?: string[];
  body?: string;
}

const starterTemplates: Record<string, string> = {
  'blank.md': '---\ntitle: Blank note\nnotebook: Notes\ntags: []\n---\n# {{title}}\n',
  'meeting.md': '---\ntitle: Meeting note\nnotebook: Meetings\ntags:\n  - meeting\n---\n# {{title}}\n\nDate: {{date}} {{time}}\n\n## Attendees\n\n## Notes\n\n## Actions\n\n- [ ] \n'
};

function localDate(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function resolveUnder(base: string, relativePath: string): string {
  const resolved = path.resolve(base, relativePath);
  const relative = path.relative(base, resolved);
  if (!relative || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))) {
    return resolved;
  }
  throw new Error(`Path is outside the notes root: ${relativePath}`);
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function atomicWrite(filePath: string, content: string): Promise<void> {
  await mkdir(path.dirname(filePath), { recursive: true });
  const temporary = `${filePath}.${randomUUID()}.tmp`;
  const backup = `${filePath}.${randomUUID()}.bak`;
  await writeFile(temporary, content, 'utf8');
  try {
    await rename(temporary, filePath);
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code !== 'EEXIST' && code !== 'EPERM') {
      throw error;
    }
    await rename(filePath, backup);
    try {
      await rename(temporary, filePath);
      await rm(backup, { force: true });
    } catch (replacementError) {
      await rm(filePath, { force: true });
      await rename(backup, filePath);
      throw replacementError;
    }
  } finally {
    await rm(temporary, { force: true });
  }
}

async function markdownFiles(root: string): Promise<string[]> {
  const entries = await readdir(root, { withFileTypes: true });
  const files = await Promise.all(entries.map(async entry => {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      return markdownFiles(fullPath);
    }
    return entry.isFile() && entry.name.toLocaleLowerCase().endsWith('.md') ? [fullPath] : [];
  }));
  return files.flat();
}

export class NoteStore {
  readonly notesRoot: string;
  readonly templatesRoot: string;

  constructor(
    readonly root: string,
    private readonly now: () => Date = () => new Date(),
    private readonly createId: () => string = () => randomUUID()
  ) {
    this.notesRoot = path.join(root, 'notes');
    this.templatesRoot = path.join(root, 'templates');
  }

  async initialize(): Promise<void> {
    await mkdir(this.notesRoot, { recursive: true });
    await mkdir(this.templatesRoot, { recursive: true });
    await Promise.all(Object.entries(starterTemplates).map(async ([name, content]) => {
      const filePath = path.join(this.templatesRoot, name);
      if (!await exists(filePath)) {
        await atomicWrite(filePath, content);
      }
    }));
  }

  async list(): Promise<NoteListResult> {
    await this.initialize();
    const files = await markdownFiles(this.notesRoot);
    const notes: Note[] = [];
    const warnings: string[] = [];
    for (const filePath of files) {
      const relativePath = path.relative(this.notesRoot, filePath).split(path.sep).join('/');
      try {
        const note = parseNote(await readFile(filePath, 'utf8'), relativePath);
        note.relativePath = relativePath;
        notes.push(note);
      } catch (error) {
        warnings.push(`${relativePath}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    notes.sort((left, right) => right.updated.localeCompare(left.updated));
    return { notes, warnings };
  }

  async read(id: string): Promise<Note> {
    const result = await this.list();
    const note = result.notes.find(candidate => candidate.id === id);
    if (!note) {
      throw new Error(`Note not found: ${id}`);
    }
    return note;
  }

  async create(input: CreateNoteInput): Promise<Note> {
    const timestamp = this.now().toISOString();
    const note: Note = {
      id: this.createId(),
      title: input.title.trim() || 'Untitled',
      notebook: input.notebook?.trim() || 'Notes',
      status: input.status ?? 'active',
      tags: input.tags?.map(tag => tag.trim()).filter(Boolean) ?? [],
      created: timestamp,
      updated: timestamp,
      body: input.body ?? '',
      relativePath: ''
    };
    note.relativePath = `${note.id}.md`;
    return this.write(note, false);
  }

  async save(note: Note): Promise<Note> {
    return this.write({ ...note, updated: this.now().toISOString() }, true);
  }

  async quickCapture(content: string): Promise<Note> {
    const title = content.split(/\r?\n/).map(line => line.trim()).find(Boolean) ?? 'Quick capture';
    return this.create({ title, notebook: 'Inbox', status: 'inbox', body: content });
  }

  async openDaily(date = this.now()): Promise<Note> {
    const day = localDate(date);
    const relativePath = `daily/${day}.md`;
    const filePath = resolveUnder(this.notesRoot, relativePath);
    if (await exists(filePath)) {
      const note = parseNote(await readFile(filePath, 'utf8'), relativePath);
      note.relativePath = relativePath;
      return note;
    }
    const timestamp = date.toISOString();
    const note: Note = {
      id: `daily-${day}`,
      title: day,
      notebook: 'Daily Notes',
      status: 'active',
      tags: ['daily'],
      created: timestamp,
      updated: timestamp,
      body: `# ${day}\n\n## Focus\n\n- [ ] \n\n## Notes\n`,
      relativePath
    };
    return this.write(note, false);
  }

  async listTemplates(): Promise<NoteTemplate[]> {
    await this.initialize();
    const files = await markdownFiles(this.templatesRoot);
    const templates = await Promise.all(files.map(async filePath => {
      const relativePath = path.relative(this.templatesRoot, filePath).split(path.sep).join('/');
      const id = relativePath.slice(0, -path.extname(relativePath).length);
      return parseTemplate(id, await readFile(filePath, 'utf8'));
    }));
    return templates.sort((left, right) => left.id.localeCompare(right.id));
  }

  async createFromTemplate(templateId: string, title: string): Promise<Note> {
    const templatePath = resolveUnder(this.templatesRoot, `${templateId}.md`);
    if (!await exists(templatePath)) {
      throw new Error(`Template not found: ${templateId}`);
    }
    const template = parseTemplate(templateId, await readFile(templatePath, 'utf8'));
    return this.create({
      title,
      notebook: template.notebook,
      tags: template.tags,
      body: expandTemplate(template, title, this.now())
    });
  }

  private async write(note: Note, requireExisting: boolean): Promise<Note> {
    if (!note.relativePath) {
      throw new Error('Note path is missing.');
    }
    const filePath = resolveUnder(this.notesRoot, note.relativePath);
    if (requireExisting && !await exists(filePath)) {
      throw new Error(`Note file not found: ${note.relativePath}`);
    }
    await atomicWrite(filePath, serializeNote(note));
    return { ...note };
  }
}
