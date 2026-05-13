interface PendingConfirm {
  title: string
  message: string
  resolve: (value: boolean) => void
}

const pending = ref<PendingConfirm | null>(null)

const open = computed(() => !!pending.value)
const title = computed(() => pending.value?.title ?? '')
const message = computed(() => pending.value?.message ?? '')

/**
 * Promise-based confirm dialog state.
 * Call `ask()` from business logic; render a dialog bound to `open/title/message`
 * and call `resolve(value)` / `cancel()` when the user acts.
 */
export function useConfirm() {
  function ask(dialogTitle: string, dialogMessage: string): Promise<boolean> {
    return new Promise((resolve) => {
      pending.value = { title: dialogTitle, message: dialogMessage, resolve }
    })
  }

  function resolve(value: boolean) {
    pending.value?.resolve(value)
    pending.value = null
  }

  function cancel() {
    pending.value?.resolve(false)
    pending.value = null
  }

  return { open, title, message, ask, resolve, cancel }
}
