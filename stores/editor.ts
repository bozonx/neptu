import { defineStore } from 'pinia'
import { useEditorActiveFile } from './editor/activeFile'
import { useEditorBuffers } from './editor/buffers'
import { useEditorCursorState } from './editor/cursorState'
import { useEditorDocuments } from './editor/documents'
import { useEditorMediaInsertion } from './editor/mediaInsertion'
import { useEditorUiState } from './editor/uiState'

/**
 * Public editor store facade.
 *
 * Internals are split by responsibility under stores/editor/:
 * buffers/autosave, document file operations, cursor state, UI state,
 * active file derivation, and insertion triggers.
 */
export const useEditorStore = defineStore('editor', () => {
  const editorBuffers = useEditorBuffers()
  const activeFile = useEditorActiveFile(editorBuffers.buffers)
  const cursorState = useEditorCursorState(activeFile.currentFilePath)
  const uiState = useEditorUiState(cursorState.cursorPositions)
  const documents = useEditorDocuments(editorBuffers.reset)
  const mediaInsertion = useEditorMediaInsertion(activeFile.currentFilePath)

  const activeSelectionText = ref('')

  function onPathMigrated(oldPath: string, newPath: string) {
    editorBuffers.migrateBufferPath(oldPath, newPath)
    cursorState.migrateCursorPath(oldPath, newPath)
  }

  return {
    buffers: editorBuffers.buffers,
    currentFilePath: activeFile.currentFilePath,
    currentContent: activeFile.currentContent,
    currentVault: activeFile.currentVault,
    hydrated: uiState.hydrated,
    activeSelectionText,
    scrollToLineTrigger: cursorState.scrollToLineTrigger,
    cursorPositions: cursorState.cursorPositions,
    openFile: editorBuffers.openFile,
    setContent: editorBuffers.setContent,
    setFrontmatter: editorBuffers.setFrontmatter,
    save: editorBuffers.save,
    waitForSave: editorBuffers.waitForSave,
    flushVault: editorBuffers.flushVault,
    flushAll: editorBuffers.flushAll,
    createNote: documents.createNote,
    createFile: documents.createFile,
    deleteNote: documents.deleteNote,
    reset: editorBuffers.reset,
    clearTimers: editorBuffers.clearTimers,
    scrollToLine: cursorState.scrollToLine,
    saveCursorPosition: cursorState.saveCursorPosition,
    getCursorPosition: cursorState.getCursorPosition,
    loadUiState: uiState.loadUiState,
    saveUiState: uiState.saveUiState,
    onPathMigrated,
    insertTrigger: mediaInsertion.insertTrigger,
    insertText: mediaInsertion.insertText,
    insertImportedFiles: mediaInsertion.insertImportedFiles,
  }
})
