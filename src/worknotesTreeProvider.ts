import * as vscode from 'vscode';

import { hasActionableTasks } from './domain/query';
import type { Note } from './domain/note';
import type { NoteStore } from './storage/noteStore';

type Section = 'notes' | 'tasks' | 'tags';
type Group = { kind: 'group'; label: string; notes: Note[] };
type Entry = { kind: 'note'; note: Note };
type Item = Group | Entry;

export class WorkNotesTreeProvider implements vscode.TreeDataProvider<Item> {
  private readonly changed = new vscode.EventEmitter<Item | undefined | null | void>();
  readonly onDidChangeTreeData = this.changed.event;

  constructor(
    private readonly section: Section,
    private readonly getStore: () => Promise<NoteStore | undefined>
  ) {}

  refresh(): void {
    this.changed.fire();
  }

  getTreeItem(item: Item): vscode.TreeItem {
    if (item.kind === 'group') {
      const treeItem = new vscode.TreeItem(item.label, vscode.TreeItemCollapsibleState.Expanded);
      treeItem.iconPath = new vscode.ThemeIcon(this.section === 'tags' ? 'tag' : 'folder');
      treeItem.contextValue = 'worknotesGroup';
      return treeItem;
    }
    const treeItem = new vscode.TreeItem(item.note.title, vscode.TreeItemCollapsibleState.None);
    treeItem.description = this.section === 'tasks' ? item.note.notebook : undefined;
    treeItem.tooltip = item.note.relativePath;
    treeItem.iconPath = new vscode.ThemeIcon(this.section === 'tasks' ? 'checklist' : 'note');
    treeItem.contextValue = 'worknotesNote';
    treeItem.command = {
      command: 'worknotes.openNote',
      title: 'Open WorkNotes Note',
      arguments: [item.note.id]
    };
    return treeItem;
  }

  async getChildren(element?: Item): Promise<Item[]> {
    if (element) {
      return element.kind === 'group' ? element.notes.map(note => ({ kind: 'note', note })) : [];
    }
    const store = await this.getStore();
    if (!store) {
      return [];
    }
    const { notes } = await store.list();
    if (this.section === 'tasks') {
      return notes.filter(note => note.status !== 'archived' && hasActionableTasks(note))
        .map(note => ({ kind: 'note', note }));
    }
    const groups = new Map<string, Note[]>();
    for (const note of notes) {
      const labels = this.section === 'tags' ? note.tags : [note.notebook || 'Notes'];
      for (const label of labels) {
        const groupNotes = groups.get(label) ?? [];
        groupNotes.push(note);
        groups.set(label, groupNotes);
      }
    }
    return [...groups].sort(([a], [b]) => a.localeCompare(b))
      .map(([label, groupNotes]) => ({ kind: 'group', label, notes: groupNotes }));
  }
}
