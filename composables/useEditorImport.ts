import type { ConflictChoice, ConflictPolicy } from '~/stores/vaults'

interface PendingPrompt {
  fileName: string
  resolve: (decision: { choice: ConflictChoice, remember: boolean }) => void
}

const pending = ref<PendingPrompt | null>(null)
const showRemember = ref(true)

/**
 * Manages the overwrite-confirmation dialog state for media imports.
 * Returns a `ConflictPolicy` that pops up a dialog for the first conflict and
 * remembers the user's choice for the rest of the batch when requested.
 */
export function useEditorImport() {
  function makeAskPolicy(): ConflictPolicy {
    let remembered: ConflictChoice | null = null
    return async (info) => {
      if (remembered) return remembered
      const decision = await new Promise<{ choice: ConflictChoice, remember: boolean }>((resolve) => {
        pending.value = { fileName: info.name, resolve }
      })
      pending.value = null
      if (decision.remember) remembered = decision.choice
      return decision.choice
    }
  }

  function resolvePrompt(decision: { choice: ConflictChoice, remember: boolean }) {
    pending.value?.resolve(decision)
  }

  function cancelPrompt() {
    pending.value?.resolve({ choice: 'skip', remember: false })
  }

  return {
    pending,
    showRemember,
    makeAskPolicy,
    resolvePrompt,
    cancelPrompt,
  }
}
