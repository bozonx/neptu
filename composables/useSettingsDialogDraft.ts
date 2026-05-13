import type { AppSettings, GitAuthor } from '~/types'

export function useSettingsDialogDraft(open: Ref<boolean>) {
  const settingsStore = useSettingsStore()
  const toast = useToast()
  const { t } = useI18n()
  const colorMode = useColorMode()

  const autosaveSec = ref(0)
  const commitSec = ref(0)
  const authorName = ref('')
  const authorEmail = ref('')
  const layoutMode = ref<AppSettings['layoutMode']>('desktop')
  const theme = ref<AppSettings['theme']>('system')
  const locale = ref<AppSettings['locale']>('auto')
  const tabDisplayMode = ref<AppSettings['tabDisplayMode']>('single_line')
  const defaultCommitMode = ref<AppSettings['defaultCommitMode']>('auto')
  const confirmDeleteLocal = ref(true)
  const confirmDeleteGit = ref(true)
  const useTrash = ref(true)
  const gitAutoMessage = ref(true)
  const gitAutoMessageTemplate = ref('')
  const detectedAuthor = ref<GitAuthor | null>(null)
  const configPath = ref('')
  const newMainPath = ref('')
  const dailyNotesPath = ref('.neptu/daily_notes')

  const detectedHint = computed(() => {
    if (!detectedAuthor.value) return ''
    const { name, email } = detectedAuthor.value
    if (!name && !email) return t('settings.notConfigured')
    const missing = '\u2014'
    return t('settings.detectedFromGit', { name: name ?? missing, email: email ?? missing })
  })

  let skipNextWatch = false

  watch(open, async (value) => {
    if (!value) return

    const s = settingsStore.settings
    skipNextWatch = true
    autosaveSec.value = +(s.autosaveDebounceMs / 1000).toFixed(2)
    commitSec.value = +(s.defaultCommitDebounceMs / 1000).toFixed(2)
    authorName.value = s.gitAuthorName
    authorEmail.value = s.gitAuthorEmail
    layoutMode.value = s.layoutMode
    theme.value = s.theme
    locale.value = s.locale
    tabDisplayMode.value = s.tabDisplayMode
    defaultCommitMode.value = s.defaultCommitMode
    confirmDeleteLocal.value = s.confirmDeleteLocal
    confirmDeleteGit.value = s.confirmDeleteGit
    useTrash.value = s.useTrash
    gitAutoMessage.value = s.gitAutoMessage ?? true
    gitAutoMessageTemplate.value = s.gitAutoMessageTemplate ?? t('settings.gitAutoMessageTemplatePlaceholder')
    dailyNotesPath.value = s.dailyNotesPath ?? t('settings.dailyNotesPathPlaceholder')
    newMainPath.value = ''

    try {
      const git = useGit()
      detectedAuthor.value = await git.globalAuthor()
      const config = useConfig()
      configPath.value = await config.getInstanceConfigPath()
    }
    catch {
      detectedAuthor.value = null
      configPath.value = ''
    }

    nextTick(() => {
      skipNextWatch = false
    })
  }, { immediate: true })

  async function browseMainFolder() {
    try {
      const path = await useFs().pickDirectory({ title: t('settings.selectNewMainVaultFolder') })
      if (path) newMainPath.value = path
    }
    catch (error) {
      toast.add({ title: t('toast.cannotOpenDialog'), description: String(error), color: 'error' })
    }
  }

  async function submitChangeMainRepo() {
    if (!newMainPath.value) return
    try {
      await settingsStore.setMainRepo(newMainPath.value)
      newMainPath.value = ''
      toast.add({ title: t('toast.mainVaultUpdated'), color: 'success' })
    }
    catch (error) {
      toast.add({
        title: t('toast.changeMainVaultFailed'),
        description: error instanceof Error ? error.message : String(error),
        color: 'error',
      })
    }
  }

  async function copyConfigPath() {
    if (!configPath.value) return
    try {
      await navigator.clipboard.writeText(configPath.value)
      toast.add({ title: t('toast.copied'), color: 'success' })
    }
    catch {
      toast.add({ title: t('toast.copyFailed'), color: 'error' })
    }
  }

  async function save() {
    try {
      await settingsStore.updateSettings({
        autosaveDebounceMs: Math.max(100, Math.round(autosaveSec.value * 1000)),
        defaultCommitDebounceMs: Math.max(1000, Math.round(commitSec.value * 1000)),
        gitAuthorName: authorName.value.trim(),
        gitAuthorEmail: authorEmail.value.trim(),
        layoutMode: layoutMode.value,
        theme: theme.value,
        locale: locale.value,
        tabDisplayMode: tabDisplayMode.value,
        defaultCommitMode: defaultCommitMode.value,
        confirmDeleteLocal: confirmDeleteLocal.value,
        confirmDeleteGit: confirmDeleteGit.value,
        useTrash: useTrash.value,
        gitAutoMessage: gitAutoMessage.value,
        gitAutoMessageTemplate: gitAutoMessageTemplate.value,
        dailyNotesPath: dailyNotesPath.value.trim() || t('settings.dailyNotesPathPlaceholder'),
      })
      colorMode.preference = theme.value
    }
    catch (error) {
      toast.add({
        title: t('toast.autoSaveFailed'),
        description: error instanceof Error ? error.message : String(error),
        color: 'error',
      })
    }
  }

  async function toggleLayoutMode() {
    layoutMode.value = layoutMode.value === 'desktop' ? 'mobile' : 'desktop'
    await save()
    open.value = false
  }

  const debouncedSave = useDebounceFn(save, 500)

  watch(
    [
      autosaveSec,
      commitSec,
      authorName,
      authorEmail,
      theme,
      locale,
      tabDisplayMode,
      defaultCommitMode,
      confirmDeleteLocal,
      confirmDeleteGit,
      useTrash,
      gitAutoMessage,
      gitAutoMessageTemplate,
      dailyNotesPath,
    ],
    () => {
      if (skipNextWatch || !open.value) return
      debouncedSave()
    },
    { deep: true },
  )

  return {
    autosaveSec,
    commitSec,
    authorName,
    authorEmail,
    layoutMode,
    theme,
    locale,
    tabDisplayMode,
    defaultCommitMode,
    confirmDeleteLocal,
    confirmDeleteGit,
    useTrash,
    gitAutoMessage,
    gitAutoMessageTemplate,
    configPath,
    newMainPath,
    dailyNotesPath,
    detectedHint,
    browseMainFolder,
    submitChangeMainRepo,
    toggleLayoutMode,
    copyConfigPath,
  }
}
