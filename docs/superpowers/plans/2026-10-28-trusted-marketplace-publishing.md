# Trusted Marketplace Publishing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a safe, OIDC-authenticated VS Code Marketplace publishing path for version tags without publishing a release during setup.

**Architecture:** A small Node script verifies `GITHUB_REF_NAME` exactly matches `v${package.json.version}`. A separate GitHub Actions workflow runs that gate, the repository's existing validation/package commands, and then publishes the resulting VSIX through the protected `marketplace` environment using OIDC.

**Tech Stack:** GitHub Actions, Node.js 24, pnpm 11.25.0, `@vscode/vsce` 4.0.0, Node test runner

**Spec:** `docs/superpowers/specs/2026-10-28-trusted-marketplace-publishing-design.md`

## Global Constraints

- Do not create or push a tag, trigger the workflow, or publish a Marketplace version.
- Do not add long-lived credentials or fallback authentication.
- Keep `.github/workflows/ci.yml` unchanged.

## Review Focus

- A tag that omits the leading `v` must fail before packaging.
- A tag whose version differs from `package.json` must fail before packaging.
- The publish job must use the `marketplace` environment and job-scoped `id-token: write`.
- The publish command must use OIDC and the VSIX already created by the package step.
- No manual dispatch or branch event may expose a publish path.

---

### Task 1: Add the release identity gate and publishing workflow

**Files:**
- Create: `.github/scripts/verify-release-tag.js`
- Create: `test/releaseTag.test.ts`
- Create: `.github/workflows/publish.yml`

**Interfaces:**
- Consumes: `GITHUB_REF_NAME` and the root `package.json` version
- Produces: exit code 0 for an exact `v<package-version>` tag; nonzero for missing, malformed, or mismatched tags

- [ ] **Step 1: Write failing tests for matching, mismatched, malformed, and missing tags**

- [ ] **Step 2: Run the focused test and confirm it fails because the verifier is absent**

Run: `pnpm exec tsc -p tsconfig.json && node --test dist/test/releaseTag.test.js`
Expected: FAIL because `.github/scripts/verify-release-tag.js` does not exist.

- [ ] **Step 3: Implement the minimal release-tag verifier**

Read `package.json`, require `GITHUB_REF_NAME`, require exact equality with `v${version}`, print the verified version, and exit nonzero with an actionable error otherwise.

- [ ] **Step 4: Run the focused test and confirm all cases pass**

Run: `pnpm exec tsc -p tsconfig.json && node --test dist/test/releaseTag.test.js`
Expected: PASS.

- [ ] **Step 5: Add `.github/workflows/publish.yml`**

Trigger only on pushed `v*` tags. Use the existing CI tool versions and commands, `environment: marketplace`, job permissions `contents: read` and `id-token: write`, and publish `worknotes-<package-version>.vsix` with `pnpm exec vsce publish --oidc --packagePath`.

- [ ] **Step 6: Verify type-check, tests, package creation, workflow syntax, and diff scope**

Run: `pnpm run check`, `pnpm test`, `pnpm run package`, and a YAML parse/contract check.
Expected: all commands pass, the VSIX exists, and only planned files changed.

- [ ] **Step 7: Commit**

Commit message: `ci: add trusted Marketplace publishing`

