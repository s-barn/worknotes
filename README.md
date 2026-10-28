# WorkNotes

WorkNotes is a local-first notes workspace inside Visual Studio Code. It uses a focused three-column layout—navigation, note list, and Markdown editor—while storing every note as an ordinary Markdown file with YAML frontmatter.

## Iteration 1 features

- Theme-aware custom editor that follows VS Code colors and typography
- Configurable local notes folder with a first-run folder picker
- Notebooks, tags, inbox/active/archived statuses, and instant search
- Quick capture into the Inbox
- Idempotent daily notes based on the local calendar date
- Markdown task discovery from `- [ ]` and `- [x]` lines
- Starter and user-authored Markdown templates
- Portable Markdown/YAML storage with no database or cloud dependency

## Install the VSIX

1. Download `worknotes-0.1.0.vsix` from the repository release or CI artifact.
2. In VS Code, open **Extensions**, choose **Views and More Actions (...)**, then **Install from VSIX...**.
3. Run **WorkNotes: Open** from the Command Palette.
4. Choose the local folder where WorkNotes should keep notes and templates.

To install from a terminal on Windows:

```powershell
code --install-extension .\worknotes-0.1.0.vsix
```

## Commands

| Command | Purpose |
| --- | --- |
| `WorkNotes: Open` | Open the three-column workspace |
| `WorkNotes: Quick Capture` | Add a thought to the Inbox and open it |
| `WorkNotes: Open Daily Note` | Create or open today's daily note |
| `WorkNotes: Choose Notes Folder` | Change the local notes root |

## Storage format

The selected folder is organized like this:

```text
My WorkNotes/
├─ notes/
│  ├─ 3c7f...md
│  └─ daily/
│     └─ 2026-10-27.md
└─ templates/
   ├─ blank.md
   └─ meeting.md
```

A note remains readable and editable in any Markdown editor:

```markdown
---
id: 3c7f...
title: WorkNotes Iteration 1
notebook: Projects
status: active
tags:
  - vscode
  - planning
created: 2026-10-27T17:00:00.000Z
updated: 2026-10-27T18:30:00.000Z
---
# WorkNotes Iteration 1

- [ ] Package the VSIX
```

Templates support `{{title}}`, `{{date}}`, and `{{time}}`. Add a Markdown file to `templates/`, optionally with `notebook` and `tags` frontmatter, and it appears in the template picker.

## Development

Requirements:

- Windows with Visual Studio Code
- Node.js 24
- pnpm 11.25.0

```powershell
pnpm install
pnpm test
pnpm run check
pnpm run package
```

Press `F5` in VS Code to launch an Extension Development Host. The packaged extension is written to `worknotes-0.1.0.vsix`.

## Current limitations

Iteration 1 intentionally has no cloud sync, note deletion, rich-text editing, mobile client, or collaboration. Changing a title does not rename the underlying ID-based filename. WorkNotes surfaces file-read and save errors without deleting or rewriting the affected source file.

## Privacy and security

Notes stay in the folder you choose. The webview loads only extension-owned local assets, uses a content security policy, validates messages at the extension boundary, and never executes note content.
