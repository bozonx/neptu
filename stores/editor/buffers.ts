import type { Vault } from "~/types";
import { getEditorViewType, isTextViewType } from "~/utils/fileTypes";
import {
  findSchemaForFile,
  parseFrontmatter,
  splitFrontmatter,
  synthesizeFile,
} from "~/composables/useFrontmatter";
import type { EditorBuffer } from "./types";

const SAVED_HINT_MS = 1500;

function findVaultForPath(path: string | null): Vault | null {
  if (!path) return null;
  return useVaultsStore().findVaultForPath(path);
}

export function useEditorBuffers() {
  const buffers = ref<Record<string, EditorBuffer>>({});
  const savedHintTimers = new Map<string, ReturnType<typeof setTimeout>>();
  const saveQueues = new Map<string, Promise<void>>();
  const saveRetryState = new Map<string, { count: number; retryAt: number }>();
  const settings = useSettingsStore();
  const debounceMs = computed(() =>
    Math.max(100, settings.settings.autosaveDebounceMs),
  );

  function setSaveStatus(
    path: string,
    next: EditorBuffer["saveStatus"],
    error: string | null = null,
  ) {
    const buffer = buffers.value[path];
    if (!buffer) return;
    buffer.saveStatus = next;
    buffer.saveError = error;
    if (next === "saved") {
      const existingTimer = savedHintTimers.get(path);
      if (existingTimer) clearTimeout(existingTimer);
      const timer = setTimeout(() => {
        savedHintTimers.delete(path);
        if (buffers.value[path]?.saveStatus === "saved") {
          buffers.value[path].saveStatus = "idle";
        }
      }, SAVED_HINT_MS);
      savedHintTimers.set(path, timer);
    }
  }

  async function openFile(path: string) {
    if (buffers.value[path]) return buffers.value[path];

    const viewType = getEditorViewType(path);
    let rawContent = "";
    let schema = null;

    if (viewType !== "virtual") {
      const fs = useFs();
      if (!(await fs.exists(path))) {
        throw new Error(`File not found: ${path}`);
      }

      if (isTextViewType(viewType)) {
        rawContent = await fs.readText(path);
      }

      const vault = findVaultForPath(path);
      const vaultsStore = useVaultsStore();
      const vaultConfig = vault ? vaultsStore.vaultConfigs[vault.id] : null;
      schema = findSchemaForFile(path, vault?.path ?? "", vaultConfig);
    }

    let content = rawContent;
    let frontmatter: Record<string, unknown> | undefined;
    let extraFrontmatter: Record<string, unknown> | undefined;

    if (schema && rawContent) {
      const parsed = parseFrontmatter(rawContent);
      if (parsed.frontmatter) {
        const split = splitFrontmatter(parsed.frontmatter, schema);
        frontmatter = split.schemaValues;
        extraFrontmatter = split.extraFrontmatter;
      } else {
        frontmatter = {};
        extraFrontmatter = {};
      }
      content = parsed.body;
    }

    buffers.value[path] = {
      content,
      isDirty: false,
      saveStatus: "idle",
      saveError: null,
      openEpoch: Date.now(),
      revision: 0,
      lastEditTimestamp: Date.now(),
      frontmatter,
      extraFrontmatter,
      schema,
    };
    return buffers.value[path];
  }

  function markDirty(path: string) {
    const buffer = buffers.value[path];
    if (!buffer) return;
    buffer.isDirty = true;
    buffer.revision += 1;
    buffer.lastEditTimestamp = Date.now();

    const vault = findVaultForPath(path);
    if (vault?.type === "git") useGitStore().cancelCommit(vault.id);
  }

  function setContent(path: string, content: string) {
    const buffer = buffers.value[path];
    if (!buffer || buffer.content === content) return;
    buffer.content = content;
    markDirty(path);
  }

  function setFrontmatter(path: string, frontmatter: Record<string, unknown>) {
    const buffer = buffers.value[path];
    if (!buffer) return;
    buffer.frontmatter = frontmatter;
    markDirty(path);
  }

  function buildFileContent(buffer: EditorBuffer): string {
    if (buffer.schema && buffer.frontmatter !== undefined) {
      const merged = {
        ...(buffer.extraFrontmatter ?? {}),
        ...(buffer.frontmatter ?? {}),
      };
      return synthesizeFile(merged, buffer.content);
    }
    return buffer.content;
  }

  async function writeDirtySnapshot(path: string): Promise<boolean> {
    const buffer = buffers.value[path];
    if (!buffer || !buffer.isDirty) return false;

    const fs = useFs();
    const snapshotRevision = buffer.revision;
    const fileContent = buildFileContent(buffer);
    setSaveStatus(path, "saving");
    try {
      await fs.writeText(path, fileContent);

      const latest = buffers.value[path];
      if (!latest) return false;

      useSearchStore().updateFile(path, fileContent);

      if (latest.revision !== snapshotRevision) {
        latest.isDirty = true;
        return true;
      }

      latest.isDirty = false;
      setSaveStatus(path, "saved");
      const vault = findVaultForPath(path);
      if (vault?.type === "git") {
        const git = useGitStore();
        if (git.effectiveCommitMode(vault.id) === "auto") {
          git.scheduleCommit(vault.id);
        } else {
          await git.refreshStatus(vault.id);
        }
      }
      return false;
    } catch (error) {
      setSaveStatus(
        path,
        "error",
        error instanceof Error ? error.message : String(error),
      );
      throw error;
    }
  }

  async function drainSaveQueue(path: string) {
    while (buffers.value[path]?.isDirty) {
      await writeDirtySnapshot(path);
    }
  }

  function save(path: string): Promise<void> {
    const existing = saveQueues.get(path) ?? Promise.resolve();
    const next = existing
      .catch(() => {
        // Preserve queue continuity after a failed write; the new caller should
        // still get a chance to save the latest dirty buffer.
      })
      .then(() => drainSaveQueue(path))
      .finally(() => {
        if (saveQueues.get(path) === next) {
          saveQueues.delete(path);
        }
      });
    saveQueues.set(path, next);
    return next;
  }

  async function waitForSave(path: string) {
    const pending = saveQueues.get(path);
    if (pending) await pending;
  }

  async function flushVault(vault: Vault) {
    const prefix = vault.path.replace(/[/\\]+$/, "") + "/";
    let firstError: unknown = null;
    for (const [path, buffer] of Object.entries(buffers.value)) {
      if (!buffer.isDirty) continue;
      if (!path.startsWith(prefix)) continue;
      try {
        await save(path);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
  }

  async function flushAll() {
    let firstError: unknown = null;
    for (const path of Object.keys(buffers.value)) {
      try {
        await save(path);
      } catch (error) {
        firstError ??= error;
      }
    }
    if (firstError) throw firstError;
  }

  function reset(path?: string) {
    if (path) {
      const timer = savedHintTimers.get(path);
      if (timer) {
        clearTimeout(timer);
        savedHintTimers.delete(path);
      }
      saveQueues.delete(path);
      saveRetryState.delete(path);
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
      delete buffers.value[path];
    } else {
      clearSavedHintTimers();
      saveQueues.clear();
      saveRetryState.clear();
      buffers.value = {};
    }
  }

  function migrateBufferPath(oldPath: string, newPath: string) {
    if (!buffers.value[oldPath]) return;
    buffers.value[newPath] = { ...buffers.value[oldPath] };
    // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
    delete buffers.value[oldPath];
  }

  const autosaveInterval = setInterval(async () => {
    const now = Date.now();
    const entries = Object.entries(buffers.value);
    for (const [path, buffer] of entries) {
      if (
        buffer.isDirty &&
        buffer.saveStatus !== "saving" &&
        now - buffer.lastEditTimestamp >= debounceMs.value
      ) {
        const retry = saveRetryState.get(path);
        if (retry && now < retry.retryAt) continue;
        try {
          await save(path);
          saveRetryState.delete(path);
        } catch {
          const count = (saveRetryState.get(path)?.count ?? 0) + 1;
          const delay = Math.min(30000, 500 * 2 ** (count - 1));
          saveRetryState.set(path, { count, retryAt: now + delay });
        }
      }
    }
  }, 500);

  function clearSavedHintTimers() {
    for (const timer of savedHintTimers.values()) {
      clearTimeout(timer);
    }
    savedHintTimers.clear();
  }

  function clearBufferTimers() {
    clearInterval(autosaveInterval);
    clearSavedHintTimers();
    saveRetryState.clear();
  }

  onScopeDispose(() => {
    clearBufferTimers();
  });

  return {
    buffers,
    openFile,
    setContent,
    setFrontmatter,
    save,
    waitForSave,
    flushVault,
    flushAll,
    reset,
    migrateBufferPath,
    clearTimers: clearBufferTimers,
  };
}
