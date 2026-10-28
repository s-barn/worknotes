# WorkNotes Iteration 1 Design

## Intent

WorkNotes is a Windows-first VS Code extension that provides a focused notes workspace while keeping every note as portable Markdown in a user-selected local folder.

## Goals

- Theme-aware three-column experience: navigation, note list, and editor.
- Local Markdown files with YAML frontmatter as the source of truth.
- Notebooks, tags, statuses, note search, Markdown tasks, quick capture/inbox, daily notes, and templates.
- First-run notes-root folder picker and a command to change it later.
- Automated tests, clear setup documentation, and a packaged VSIX.

## Non-goals

- Cloud synchronization, collaboration, mobile clients, rich-text editing, or a proprietary database.
- Perfect visual parity with any third-party notes application; the design uses its own compact information architecture and density.
- Plugin APIs or speculative extension points.

## Constraints

- TypeScript extension targeting current VS Code on Windows.
- Follow VS Code theme tokens and accessibility conventions.
- Do not execute note content or load remote resources in the webview.
- Keep storage human-readable and recoverable without WorkNotes.

## Approach

The extension uses one VS Code webview panel for the three-column UI. A small domain/storage core handles frontmatter, querying, tasks, templates, and filesystem operations. The webview is framework-free HTML/CSS/JavaScript so Iteration 1 stays easy to package and maintain. Extension-to-webview messages are explicit commands and immutable snapshots.

Alternatives considered were native VS Code tree views plus the text editor, which would not deliver the requested app-like experience, and a React-based webview, which would add build/runtime complexity without a demonstrated Iteration 1 need.

## Storage

The selected root contains `notes/` and `templates/`. Notes are Markdown files with frontmatter fields for `id`, `title`, `notebook`, `status`, `tags`, `created`, and `updated`. Daily notes use deterministic `daily/YYYY-MM-DD.md` paths. Templates are Markdown files with optional frontmatter and `{{date}}`, `{{time}}`, and `{{title}}` variables.

## Safety and error handling

All paths are resolved beneath the configured root, writes use a temporary file followed by replacement, malformed note files are surfaced as warnings without blocking valid notes, and webview HTML uses a nonce-based content security policy. Destructive note deletion is intentionally omitted from Iteration 1.

## Verification

Unit/integration tests cover frontmatter round trips, search and filters, task extraction, storage, daily-note idempotency, quick capture, and template expansion. Final verification includes tests, type checking, VSIX packaging, extension manifest inspection, and a clean Git diff review.
