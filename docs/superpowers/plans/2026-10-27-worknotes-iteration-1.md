# WorkNotes Iteration 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans.

**Goal:** Deliver a packaged Windows-first VS Code notes extension with a focused custom UI and local Markdown/YAML storage.

**Spec:** `docs/superpowers/specs/2026-10-27-worknotes-iteration-1-design.md`

**Architecture:** A framework-free VS Code webview consumes snapshots from a tested TypeScript domain/storage service. VS Code-specific activation, folder selection, commands, and notifications stay in a thin adapter.

**Tech Stack:** TypeScript, VS Code Extension API, Node.js filesystem APIs, `yaml`, Node test runner, `@vscode/vsce`, pnpm.

## Global Constraints

- Windows-first VS Code extension; notes remain portable Markdown files.
- Configurable local root with first-run folder picker.
- Theme-aware, nonce-protected webview with no remote resources.
- No cloud sync, deletion, or speculative plugin architecture.

## Review Focus

- Malformed frontmatter must not prevent other notes from loading.
- User-entered titles must not escape the configured root or create unsafe paths.
- Daily-note creation must be idempotent for a local calendar date.
- Search and filters must combine predictably and case-insensitively.
- Save failures must surface without losing the editor's current content.

---

### Task 1: Domain model and Markdown format

**Files:** `src/domain/note.ts`, `src/domain/markdown.ts`, `src/domain/query.ts`, `test/domain.test.ts`

**Interfaces:** Produces `Note`, `NoteStatus`, `parseNote`, `serializeNote`, `extractTasks`, and `filterNotes`.

- [ ] Write failing tests for frontmatter round trip, malformed fields, task extraction, and combined search/filter behavior.
- [ ] Run the tests and confirm they fail because production modules do not exist.
- [ ] Implement the minimal domain modules.
- [ ] Run the focused tests and full suite.
- [ ] Commit the task.

### Task 2: Local storage and note workflows

**Files:** `src/storage/noteStore.ts`, `src/domain/templates.ts`, `test/noteStore.test.ts`

**Interfaces:** Consumes the Task 1 format; produces `NoteStore.list/read/create/save/quickCapture/openDaily/listTemplates/createFromTemplate`.

- [ ] Write failing integration tests using a temporary directory.
- [ ] Confirm failures are caused by missing storage behavior.
- [ ] Implement safe root-bound paths, atomic writes, daily notes, quick capture, and templates.
- [ ] Run focused tests and full suite.
- [ ] Commit the task.

### Task 3: VS Code adapter and three-column webview

**Files:** `src/extension.ts`, `src/worknotesPanel.ts`, `src/webview/*`, `package.json`, `assets/worknotes.svg`

**Interfaces:** Consumes `NoteStore`; produces activation commands and the theme-aware WorkNotes panel.

- [ ] Add message-validation tests for webview commands.
- [ ] Confirm they fail before the adapter exists.
- [ ] Implement activation, configuration, first-run folder selection, commands, panel snapshots, editing, filters, templates, and error notifications.
- [ ] Run tests and type checking.
- [ ] Commit the task.

### Task 4: Documentation and VSIX delivery

**Files:** `README.md`, `CHANGELOG.md`, `.vscodeignore`, `.github/workflows/ci.yml`

**Interfaces:** Packages the extension and documents installation, storage, commands, limitations, and development.

- [ ] Add documentation and CI configuration.
- [ ] Run the complete test and type-check commands.
- [ ] Package the VSIX and inspect its contents.
- [ ] Commit, review the branch, push, and open a pull request.
