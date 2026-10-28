import { randomBytes } from 'node:crypto';

import * as vscode from 'vscode';

import { hasActionableTasks } from './domain/query';
import type { NoteStore } from './storage/noteStore';
import { parseClientMessage, type ClientMessage } from './webview/messages';

export interface WorkNotesPanelDependencies {
  getStore(): Promise<NoteStore | undefined>;
  chooseRoot(): Promise<NoteStore | undefined>;
}

export class WorkNotesPanel {
  private static current: WorkNotesPanel | undefined;
  private readonly disposables: vscode.Disposable[] = [];
  private selectedId: string | undefined;

  static async show(
    extensionUri: vscode.Uri,
    dependencies: WorkNotesPanelDependencies,
    selectedId?: string
  ): Promise<void> {
    if (WorkNotesPanel.current) {
      WorkNotesPanel.current.panel.reveal(vscode.ViewColumn.One);
      WorkNotesPanel.current.selectedId = selectedId ?? WorkNotesPanel.current.selectedId;
      await WorkNotesPanel.current.refresh();
      return;
    }

    const panel = vscode.window.createWebviewPanel(
      'worknotes.workspace',
      'WorkNotes',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(extensionUri, 'media')
        ]
      }
    );
    panel.iconPath = vscode.Uri.joinPath(extensionUri, 'assets', 'worknotes.svg');
    WorkNotesPanel.current = new WorkNotesPanel(panel, extensionUri, dependencies, selectedId);
    await WorkNotesPanel.current.refresh();
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    private readonly dependencies: WorkNotesPanelDependencies,
    selectedId?: string
  ) {
    this.selectedId = selectedId;
    this.panel.webview.html = this.html(extensionUri);
    this.panel.onDidDispose(() => this.dispose(), undefined, this.disposables);
    this.panel.webview.onDidReceiveMessage(value => this.handle(value), undefined, this.disposables);
  }

  private async handle(value: unknown): Promise<void> {
    const message = parseClientMessage(value);
    if (!message) {
      await this.panel.webview.postMessage({ type: 'error', message: 'WorkNotes received an invalid editor message.' });
      return;
    }

    try {
      if (message.type === 'chooseRoot') {
        const store = await this.dependencies.chooseRoot();
        if (store) {
          this.selectedId = undefined;
          await this.refresh(store);
        }
        return;
      }

      const store = await this.dependencies.getStore();
      if (!store) {
        await this.panel.webview.postMessage({ type: 'unconfigured' });
        return;
      }
      await this.handleWithStore(store, message);
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      await vscode.window.showErrorMessage(`WorkNotes: ${messageText}`);
      await this.panel.webview.postMessage({ type: 'error', message: messageText });
    }
  }

  private async handleWithStore(store: NoteStore, message: ClientMessage): Promise<void> {
    switch (message.type) {
      case 'ready':
        await this.refresh(store);
        break;
      case 'selectNote':
        this.selectedId = message.id;
        await this.refresh(store);
        break;
      case 'newNote': {
        const note = await store.create({ title: 'Untitled', body: '# Untitled\n' });
        this.selectedId = note.id;
        await this.refresh(store);
        break;
      }
      case 'saveNote': {
        const note = await store.save(message.note);
        this.selectedId = note.id;
        await this.refresh(store);
        await this.panel.webview.postMessage({ type: 'saved' });
        break;
      }
      case 'quickCapture': {
        if (message.content.trim()) {
          const note = await store.quickCapture(message.content);
          this.selectedId = note.id;
          await this.refresh(store);
        }
        break;
      }
      case 'openDaily': {
        const note = await store.openDaily();
        this.selectedId = note.id;
        await this.refresh(store);
        break;
      }
      case 'createFromTemplate': {
        const note = await store.createFromTemplate(message.templateId, message.title);
        this.selectedId = note.id;
        await this.refresh(store);
        break;
      }
      case 'chooseRoot':
        break;
    }
  }

  private async refresh(providedStore?: NoteStore): Promise<void> {
    const store = providedStore ?? await this.dependencies.getStore();
    if (!store) {
      await this.panel.webview.postMessage({ type: 'unconfigured' });
      return;
    }
    const [result, templates] = await Promise.all([store.list(), store.listTemplates()]);
    if (!this.selectedId || !result.notes.some(note => note.id === this.selectedId)) {
      this.selectedId = result.notes[0]?.id;
    }
    await this.panel.webview.postMessage({
      type: 'snapshot',
      root: store.root,
      notes: result.notes.map(note => ({ ...note, hasTasks: hasActionableTasks(note) })),
      selectedId: this.selectedId,
      templates,
      warnings: result.warnings
    });
  }

  private html(extensionUri: vscode.Uri): string {
    const webview = this.panel.webview;
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.css'));
    const navigationUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'navigation.js'));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, 'media', 'main.js'));
    const nonce = randomNonce();
    return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
  <link rel="stylesheet" href="${styleUri}">
  <title>WorkNotes</title>
</head>
<body>
  <div id="app" class="shell" aria-label="WorkNotes workspace">
    <aside class="sidebar">
      <div class="brand"><span class="brand-mark">W</span><strong>WorkNotes</strong></div>
      <button id="new-note" class="primary">+ New note</button>
      <button id="daily-note" class="nav-button">Today</button>
      <nav aria-label="Note filters">
        <button class="nav-button active" data-filter="all">All notes <span id="all-count"></span></button>
        <button class="nav-button" data-filter="inbox">Inbox <span id="inbox-count"></span></button>
        <button class="nav-button" data-filter="daily">Daily notes</button>
        <button class="nav-button" data-filter="tasks">Tasks</button>
        <button class="nav-button" data-filter="archived">Archived</button>
      </nav>
      <section><h2>Notebooks</h2><div id="notebooks"></div></section>
      <section><h2>Tags</h2><div id="tags" class="tags"></div></section>
      <div class="capture">
        <label for="capture-input">Quick capture</label>
        <textarea id="capture-input" rows="3" placeholder="Drop a thought in the inbox..."></textarea>
        <button id="capture-button">Capture</button>
      </div>
      <button id="choose-root" class="root-button" title="Change local notes folder">Notes folder</button>
    </aside>
    <section class="note-column">
      <div class="list-toolbar"><input id="search" type="search" placeholder="Search notes" aria-label="Search notes"></div>
      <div id="note-list" class="note-list" role="list"></div>
    </section>
    <main class="editor-column">
      <div id="empty" class="empty-state"><h1>Your notes, where you work.</h1><p>Create a note or choose your local notes folder.</p><button id="empty-choose-root">Choose notes folder</button></div>
      <form id="editor" class="editor hidden">
        <div class="editor-toolbar">
          <input id="title" class="title" aria-label="Note title">
          <button type="submit" class="primary save">Save</button>
        </div>
        <div class="metadata">
          <label>Notebook <input id="notebook"></label>
          <label>Status <select id="status"><option value="inbox">Inbox</option><option value="active">Active</option><option value="archived">Archived</option></select></label>
          <label class="tag-field">Tags <input id="note-tags" placeholder="comma, separated"></label>
        </div>
        <textarea id="body" class="body" spellcheck="true" aria-label="Markdown note body"></textarea>
        <div class="editor-footer"><span id="save-state">Markdown + YAML frontmatter</span><span id="note-path"></span></div>
      </form>
      <div class="template-bar">
        <select id="template-select" aria-label="Note template"></select>
        <button id="template-button">New from template</button>
      </div>
      <div id="toast" role="status" aria-live="polite"></div>
    </main>
  </div>
  <script nonce="${nonce}" src="${navigationUri}"></script>
  <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
  }

  private dispose(): void {
    WorkNotesPanel.current = undefined;
    while (this.disposables.length) {
      this.disposables.pop()?.dispose();
    }
  }
}

function randomNonce(): string {
  return randomBytes(24).toString('base64');
}
