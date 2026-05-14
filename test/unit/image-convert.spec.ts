import { describe, expect, it } from 'vitest'
import {
  isConvertibleImageFileName,
  isImageFileName,
  replaceMarkdownAssetReference,
} from '../../composables/useImageConvert'

describe('image conversion utilities', () => {
  it('distinguishes viewable images from convertible images', () => {
    expect(isImageFileName('diagram.svg')).toBe(true)
    expect(isImageFileName('animation.gif')).toBe(true)
    expect(isImageFileName('photo.avif')).toBe(true)

    expect(isConvertibleImageFileName('photo.png')).toBe(true)
    expect(isConvertibleImageFileName('photo.jpg')).toBe(true)
    expect(isConvertibleImageFileName('photo.jpeg')).toBe(true)
    expect(isConvertibleImageFileName('photo.webp')).toBe(true)

    expect(isConvertibleImageFileName('diagram.svg')).toBe(false)
    expect(isConvertibleImageFileName('animation.gif')).toBe(false)
    expect(isConvertibleImageFileName('icon.ico')).toBe(false)
    expect(isConvertibleImageFileName('raw.tiff')).toBe(false)
    expect(isConvertibleImageFileName('photo.avif')).toBe(false)
  })

  it('updates only matching markdown asset references', () => {
    const content = [
      '![cover](./media/photo.png)',
      '[download](media/photo.png?raw=1)',
      '<img src="./media/photo.png#preview">',
      '![other](./media/photo-old.png)',
      '`./media/photo.png`',
    ].join('\n')

    expect(
      replaceMarkdownAssetReference(
        content,
        './media/photo.png',
        './media/photo.webp',
      ),
    ).toBe([
      '![cover](./media/photo.webp)',
      '[download](media/photo.webp?raw=1)',
      '<img src="./media/photo.webp#preview">',
      '![other](./media/photo-old.png)',
      '`./media/photo.png`',
    ].join('\n'))
  })
})
