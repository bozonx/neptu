/**
 * Returns the viewport coordinates of the caret in a textarea using a
 * temporary mirror element. Accounts for padding, borders, and scroll.
 */
export function getTextareaCaretPosition(
  textarea: HTMLTextAreaElement,
): { left: number, top: number } {
  const style = window.getComputedStyle(textarea)
  const div = document.createElement('div')
  document.body.appendChild(div)

  div.style.position = 'absolute'
  div.style.visibility = 'hidden'
  div.style.whiteSpace = 'pre-wrap'
  div.style.wordWrap = 'break-word'
  div.style.overflowWrap = 'break-word'
  div.style.font = style.font
  div.style.lineHeight = style.lineHeight
  div.style.letterSpacing = style.letterSpacing
  div.style.padding = style.padding
  div.style.border = style.border
  div.style.width = `${textarea.clientWidth}px`
  div.style.boxSizing = style.boxSizing

  const text = textarea.value.substring(0, textarea.selectionStart)
  const span = document.createElement('span')
  span.textContent = textarea.value.substring(textarea.selectionStart) || '\u200b'

  div.textContent = text
  div.appendChild(span)

  const textareaRect = textarea.getBoundingClientRect()
  const spanRect = span.getBoundingClientRect()
  const divRect = div.getBoundingClientRect()

  const left = textareaRect.left + (spanRect.left - divRect.left) - textarea.scrollLeft
  const top = textareaRect.top + (spanRect.top - divRect.top) - textarea.scrollTop

  document.body.removeChild(div)
  return { left, top }
}
