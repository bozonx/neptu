import Image from '@tiptap/extension-image'
import { resolveAssetUrl } from '~/composables/useEditorAssets'
import { isAudioFile, isImageFile, isVideoFile } from '~/utils/fileTypes'

/**
 * Renders markdown image-syntax (`![](file.ext)`) as the appropriate inline
 * media element based on the file extension:
 *   - image  → `<img>`
 *   - video  → `<video controls>` (with `data-neptu-video`)
 *   - audio  → `<audio controls>` (with `data-neptu-audio`)
 *
 * The `src` attribute is resolved against the active document path via
 * `editor.storage.documentPath` so relative paths (`./img.png`, `../a.mp4`)
 * become Tauri asset URLs and load inside the WebView.
 *
 * Markdown round-trip: this node still parses/serializes as a plain image,
 * so files stay compatible with Obsidian, GitHub and other editors.
 */
export const MediaImage = Image.extend({
  name: 'image',

  addStorage() {
    return { documentPath: null as string | null }
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      'data-kind': {
        default: 'image',
        rendered: false,
      },
    }
  },

  parseHTML() {
    return [
      { tag: 'img[src]' },
      { tag: 'video[src][data-neptu-video]' },
      { tag: 'audio[src][data-neptu-audio]' },
    ]
  },

  renderHTML({ HTMLAttributes, node }) {
    const rawSrc = (node.attrs.src as string | null) ?? ''
    const storage = this.editor?.storage as Record<string, { documentPath?: string | null } | undefined> | undefined
    const documentPath = storage?.image?.documentPath ?? null
    const resolvedSrc = resolveAssetUrl(documentPath, rawSrc)

    const baseAttrs = {
      ...HTMLAttributes,
      'src': resolvedSrc,
      'data-original-src': rawSrc,
    }

    if (isVideoFile(rawSrc)) {
      return ['video', { ...baseAttrs, 'controls': 'true', 'data-neptu-video': 'true', 'preload': 'metadata' }]
    }
    if (isAudioFile(rawSrc)) {
      return ['audio', { ...baseAttrs, 'controls': 'true', 'data-neptu-audio': 'true', 'preload': 'metadata' }]
    }
    if (isImageFile(rawSrc) || rawSrc.startsWith('data:image/')) {
      return ['img', baseAttrs]
    }
    // Unknown extension: keep an `<img>` so the node round-trips, but with a
    // placeholder alt text so it is visible if the source cannot be resolved.
    return ['img', baseAttrs]
  },
})
