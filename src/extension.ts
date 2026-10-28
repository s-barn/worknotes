import * as vscode from 'vscode';

import { writableConfigurationScope } from './configuration';
import { NoteStore } from './storage/noteStore';
import { WorkNotesPanel, type WorkNotesPanelDependencies } from './worknotesPanel';
import { WorkNotesTreeProvider } from './worknotesTreeProvider';

const configurationSection = 'worknotes';
const notesRootSetting = 'notesRoot';

export function activate(context: vscode.ExtensionContext): void {
  const dependencies: WorkNotesPanelDependencies = {
    getStore: () => getStore(false),
    chooseRoot
  };

  const providers = ['notes', 'tasks', 'tags'].map(section => {
    const provider = new WorkNotesTreeProvider(section as 'notes' | 'tasks' | 'tags', () => getStore(false));
    context.subscriptions.push(vscode.window.registerTreeDataProvider(`worknotes.${section}`, provider));
    return provider;
  });
  const refreshViews = () => providers.forEach(provider => provider.refresh());

  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(event => {
      if (event.affectsConfiguration('worknotes.notesRoot')) {
        refreshViews();
      }
    }),
    vscode.commands.registerCommand('worknotes.refreshViews', refreshViews),
    vscode.commands.registerCommand('worknotes.openNote', async (id: string) => {
      const store = await getStore(true);
      if (store) {
        await WorkNotesPanel.show(context.extensionUri, dependencies, id);
      }
    }),
    vscode.commands.registerCommand('worknotes.open', async () => {
      const store = await getStore(true);
      if (store) {
        await WorkNotesPanel.show(context.extensionUri, dependencies);
        refreshViews();
      }
    }),
    vscode.commands.registerCommand('worknotes.quickCapture', async () => {
      const store = await getStore(true);
      if (!store) {
        return;
      }
      const content = await vscode.window.showInputBox({
        title: 'Quick capture to WorkNotes Inbox',
        prompt: 'What do you want to remember?',
        ignoreFocusOut: true
      });
      if (content?.trim()) {
        const note = await store.quickCapture(content);
        await WorkNotesPanel.show(context.extensionUri, dependencies, note.id);
        refreshViews();
      }
    }),
    vscode.commands.registerCommand('worknotes.openDaily', async () => {
      const store = await getStore(true);
      if (store) {
        const note = await store.openDaily();
        await WorkNotesPanel.show(context.extensionUri, dependencies, note.id);
      }
    }),
    vscode.commands.registerCommand('worknotes.chooseNotesRoot', async () => {
      const store = await chooseRoot();
      if (store) {
        await WorkNotesPanel.show(context.extensionUri, dependencies);
      }
    })
  );
}

export function deactivate(): void {
  // VS Code disposes subscriptions registered by activate.
}

async function getStore(promptWhenMissing: boolean): Promise<NoteStore | undefined> {
  const configured = vscode.workspace.getConfiguration(configurationSection).get<string>(notesRootSetting)?.trim();
  if (!configured) {
    return promptWhenMissing ? chooseRoot() : undefined;
  }
  const store = new NoteStore(configured);
  await store.initialize();
  return store;
}

async function chooseRoot(): Promise<NoteStore | undefined> {
  const selection = await vscode.window.showOpenDialog({
    title: 'Choose your WorkNotes folder',
    canSelectFiles: false,
    canSelectFolders: true,
    canSelectMany: false,
    openLabel: 'Use this folder'
  });
  const selected = selection?.[0];
  if (!selected) {
    return undefined;
  }
  const configuration = vscode.workspace.getConfiguration(configurationSection);
  const scope = writableConfigurationScope(configuration.inspect(notesRootSetting) ?? {});
  const target = scope === 'workspaceFolder'
    ? vscode.ConfigurationTarget.WorkspaceFolder
    : scope === 'workspace'
      ? vscode.ConfigurationTarget.Workspace
      : vscode.ConfigurationTarget.Global;
  await configuration.update(
    notesRootSetting,
    selected.fsPath,
    target
  );
  const store = new NoteStore(selected.fsPath);
  await store.initialize();
  return store;
}
