import type { AnyExtension } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import Placeholder from '@tiptap/extension-placeholder'
import Link from '@tiptap/extension-link'
import { Table } from '@tiptap/extension-table'
import { TableCell } from '@tiptap/extension-table-cell'
import { TableHeader } from '@tiptap/extension-table-header'
import { TableRow } from '@tiptap/extension-table-row'
import { TaskList } from '@tiptap/extension-task-list'
import { TaskItem } from '@tiptap/extension-task-item'
import { Markdown } from '@tiptap/markdown'
import { MediaImage } from '~/app-extensions/Media'
import { SearchHighlight } from '~/app-extensions/SearchHighlight'

export function useEditorTextExtensions(t: (key: string) => string): AnyExtension[] {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      link: false,
    }),
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: 'https',
      HTMLAttributes: {
        class: 'text-primary underline underline-offset-2 cursor-pointer',
      },
    }),
    MediaImage.configure({
      allowBase64: true,
      HTMLAttributes: {
        class: 'max-w-full rounded-md border border-default',
      },
    }),
    TaskList.configure({
      HTMLAttributes: { class: 'neptu-task-list' },
    }),
    TaskItem.configure({
      nested: true,
      HTMLAttributes: { class: 'neptu-task-item' },
    }),
    SearchHighlight,
    Markdown.configure({
      markedOptions: {
        gfm: true,
        breaks: false,
      },
    }),
    Placeholder.configure({
      placeholder: () => t('editor.startWriting'),
    }),
    Table.configure({
      resizable: true,
    }),
    TableRow,
    TableHeader,
    TableCell,
  ]
}
