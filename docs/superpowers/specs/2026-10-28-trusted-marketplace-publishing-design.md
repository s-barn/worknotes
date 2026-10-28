# Trusted Marketplace Publishing Design

## Intent

Publish future WorkNotes releases to the VS Code Marketplace from GitHub Actions without a long-lived Marketplace token.

## Goals

- Add `.github/workflows/publish.yml` for `v*` tags.
- Require the pushed tag to equal `v` plus `package.json`'s version before packaging.
- Reuse the repository's Node 24, pnpm 11.25.0, checks, tests, and packaging flow.
- Request only `contents: read` and `id-token: write`, and bind the job to the existing `marketplace` GitHub environment.
- Publish the already-built VSIX with `vsce publish --oidc`.

## Non-goals and constraints

- Do not create or push a release tag, run the workflow, or publish an extension version.
- Do not add a PAT, secret, fallback credential, manual trigger, or automatic version bump.
- Keep the existing CI workflow unchanged.

## Approach

Use one dedicated workflow and a small Node tag/version verifier. A separate verifier is preferable to an inline shell fragment because it can be exercised locally against matching, mismatched, and malformed tags. Publishing the VSIX produced by the existing package script ensures the tested artifact is the artifact submitted to Marketplace.

