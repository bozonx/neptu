# Neptu

Cross-platform markdown notes editor for desktop and mobile, built on
[Tauri 2](https://v2.tauri.app/) and [Nuxt 4 / Nuxt UI 4](https://ui.nuxt.com/).

## Features (scaffold)

- Sidebar with project list (collapses on desktop, slides over on mobile).
- Add a project by picking a folder. Supported types: **local folder** (Git /
  GitHub / GitLab are stubbed for later).
- Project tree shows only `.md` files, hidden directories (`.git`, `.neptu`, …)
  are skipped.
- Create / delete `.md` notes inside any project.
- Central `<textarea>` editor with **autosave** (800 ms debounce) and a status
  indicator.
- First-run wizard asks for a *main repository*; settings live inside
  `<mainRepo>/.neptu/config.json` so they can be synced between devices.

## Stack

- **Frontend**: Nuxt 4 (SPA, `ssr: false`), Nuxt UI 4 (Tailwind v4), TypeScript,
  Pinia, VueUse.
- **Shell**: Tauri 2 with plugins `fs`, `dialog`, `store`, `os`.
- **Build**: `nuxt generate` produces `dist/`, packaged by Tauri.

## Project layout

```
package.json          # Nuxt + Tauri scripts
nuxt.config.ts        # ssr: false, modules, vite tweaks for Tauri
app.config.ts         # Nuxt UI theme
app.vue / pages/      # entry + index page
layouts/default.vue   # UDashboardGroup + UDashboardSidebar
components/           # AppSidebar, ProjectTree, Editor, FirstRunDialog
composables/          # useFs, useConfig, useTauri
stores/projects.ts    # main state (Pinia)
types/index.ts        # shared types
src-tauri/            # Rust shell (Cargo.toml, tauri.conf.json, capabilities)
```

## Prerequisites

- Node ≥ 20, **pnpm** 10+
- Rust toolchain (`rustup`, stable)
- Linux: standard webkit2gtk / libsoup deps (see Tauri docs)
- (Optional) Android SDK + NDK / Xcode for mobile targets

## Install

```bash
pnpm install
```

> The `postinstall` hook runs `nuxt prepare`, which generates types and
> auto-imports under `.nuxt/`. Editor errors about missing globals
> (`defineNuxtConfig`, `useFs`, etc.) disappear after the first install.

## Run desktop app (dev)

```bash
pnpm tauri:dev
```

Tauri starts the Nuxt dev server (`pnpm dev`) on port 3000 and opens the native
window. Edits hot-reload.

## Build desktop bundle

```bash
pnpm tauri:build
```

> First build needs app icons. Generate them once with
> `pnpm tauri icon path/to/source.png` (any 1024×1024 PNG).

## Mobile (Android / iOS)

```bash
pnpm tauri:android:init     # one-time
pnpm tauri:android:dev

pnpm tauri:ios:init          # macOS only, one-time
pnpm tauri:ios:dev
```

The Nuxt dev server is exposed on `0.0.0.0:3000` so physical devices can reach
it.

## How it works

1. On first launch the app reads its system store
   (`@tauri-apps/plugin-store` → `neptu.json` in app data dir). If
   `mainRepoPath` is missing, the **First-run dialog** asks the user to pick a
   folder.
2. The chosen folder gains a hidden `.neptu/config.json` that holds the list of
   projects (the main repo itself is added as the first project).
3. Adding a project opens a folder picker. The repo gets recursively scanned
   for `.md` files and rendered as a tree.
4. Opening a file loads its content into the Pinia store. Typing in the
   textarea updates `currentContent`; a debounced watcher writes the file back
   after 800 ms.
5. Creating / deleting notes uses `@tauri-apps/plugin-fs` (`writeTextFile`,
   `remove`), the tree is refreshed afterwards.

## Filesystem permissions

`src-tauri/capabilities/default.json` allows reading/writing under common user
locations (`$HOME`, `$DOCUMENT`, `$DOWNLOAD`, `$DESKTOP`, `$APPDATA`,
`$APPCONFIG`, `$APPLOCALDATA`). Tighten or broaden the `fs:scope` block to fit
your security needs.

## Roadmap

- [ ] Git / GitHub / GitLab project types
- [ ] Markdown preview & syntax highlighting
- [ ] Search across notes
- [ ] Conflict-aware autosave
- [ ] App icons & branding

## License

MIT
