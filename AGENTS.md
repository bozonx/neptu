# AGENTS.md

Quick reference for AI agents working on this repo.

## What this is

Cross-platform markdown notes editor: **Nuxt 4 (SPA, `ssr: false`) + Nuxt UI 4
(Tailwind v4) + Pinia** in the frontend, **Tauri 2** as the shell, **git2**
(libgit2 vendored) for git operations. See `README.md` for the user-facing
overview.

## Project layout

```
app.vue                 # root <UApp>
pages/index.vue         # entry, triggers settings.init()
layouts/default.vue     # sidebar + slot
components/             # AppSidebar, Editor, VaultTree, *Dialog
composables/            # useFs, useConfig, useGit, useTauri
stores/                 # Pinia setup-stores: settings, vaults, git, editor
types/index.ts          # shared types
src-tauri/              # Rust shell, git.rs holds invoke handlers
```

Flat Nuxt layout (`srcDir: '.'`). Auto-imports for `components/`,
`composables/`, `stores/`, `~/types`. Do **not** add manual imports for them.

## Architecture rules

- **Setup stores only.** Each store owns one concern:
  - `useSettingsStore` — main repo path, `AppSettings`, persistence of
    `config.json` in the Tauri app config directory.
  - `useVaultsStore` — vault list and per-vault file trees.
  - `useGitStore` — git status, commit status, debounced auto-commit timers.
  - `useEditorStore` — current file buffer, save status, autosave watcher,
    note create/delete.
- **Persistence is centralized** in `useSettingsStore.persist()`. Any store
  that mutates `vaults` or `settings` calls `settings.persist()` after the
  change. Never write the config file from anywhere else.
- **Native I/O goes through composables** (`useFs`, `useConfig`, `useGit`),
  never directly through `@tauri-apps/*` from a component or store. Composables
  are the single seam for tests/mocks.
- **Rust commands** live in `src-tauri/src/git.rs` and are exposed via
  `useGit()`. To add one: declare `#[tauri::command]`, register it in
  `src-tauri/src/lib.rs`, add a typed wrapper in `composables/useGit.ts`, types
  in `types/index.ts`.

## Conventions

- TypeScript everywhere, `strict: true`. Prefer `interface` for object shapes.
- Named exports only (per global rules).
- Comments and JSDoc in English; UI strings in English (no i18n yet).
- Add complex-block comments only; no inline trailing comments.
- Keep changes minimal and focused; don't break existing tests.
- Follow ESLint config (`pnpm lint`). Run `pnpm lint:fix` before committing.

## Commands

```bash
pnpm install            # also runs `nuxt prepare`
pnpm tauri:dev          # desktop dev (do NOT use `pnpm dev` alone — needs Tauri runtime)
pnpm lint               # ESLint check
pnpm lint:fix           # ESLint autofix
pnpm typecheck          # vue-tsc
pnpm tauri:build        # production bundle
```

## Adding things

- **New Tauri command** → `src-tauri/src/<module>.rs`, register in `lib.rs`,
  wrap in `composables/useGit.ts` (or new composable), add types.
- **New store** → setup-store in `stores/`, never depend on `useEditorStore`
  from `useSettingsStore` (avoid cycles). Cross-store reads must go from
  editor/git → vaults → settings, not the reverse.
- **New filesystem helper** → extend `composables/useFs.ts`. All paths are
  absolute. Keep platform-agnostic via `@tauri-apps/api/path`.
- **New permission** → update `src-tauri/capabilities/default.json`.

## Things to know about gotchas

- App requires Tauri runtime; `pnpm dev` alone shows a blocking modal.
- Config and UI state live in the Tauri app config directory (`config.json` and
  `ui-state.json`). Don't write absolute paths there that won't roam.
- Auto-commit timer is reset by every keystroke and started only after a
  successful autosave. See `useGitStore.scheduleCommit`.
- Editor uses an `openEpoch` to ignore stale `readTextFile` results when the
  user switches files quickly. Don't bypass it.
