/** Text helpers shared by the sync modules. */

const LONE_SURROGATE = /[\uD800-\uDFFF]/

/**
 * The text with every lone UTF-16 surrogate replaced by U+FFFD (what `String.prototype.toWellFormed` does, which Safari
 * and older browsers lack). `TextEncoder` makes the same replacement, so a text and its UTF-8 bytes then agree -- the
 * server refuses (and cannot hash) a text that does not survive UTF-8, and a hash must be of the text actually sent.
 */
export function wellFormed(text: string): string {
  if (!LONE_SURROGATE.test(text)) return text
  let out = ''
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index)
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = text.charCodeAt(index + 1)
      if (next >= 0xdc00 && next <= 0xdfff) {
        out += text[index] + text[index + 1]
        index += 1
      } else {
        out += '�'
      }
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      out += '�'
    } else {
      out += text[index]
    }
  }
  return out
}

/** UTF-8 length of a text (an upper bound, 3 bytes a character, for a short one: the exact count is only worth its cost on a big text). */
export function utf8Length(text: string): number {
  return text.length <= 1024 ? text.length * 3 : new TextEncoder().encode(text).length
}
