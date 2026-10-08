/**
 * WCAG contrast arithmetic, used to hold reading mode's syntax colours to
 * 4.5:1. The stock Prism themes were made for looks rather than legibility:
 * oneLight's comments, for instance, sit near 2.5:1 on a pale background.
 */

export type Rgb = [number, number, number]

function clampByte(value: number): number {
  return Math.min(255, Math.max(0, Math.round(value)))
}

function hslToRgb(hue: number, saturation: number, lightness: number): Rgb {
  const h = (((hue % 360) + 360) % 360) / 360
  const s = Math.min(1, Math.max(0, saturation / 100))
  const l = Math.min(1, Math.max(0, lightness / 100))
  if (s === 0) return [clampByte(l * 255), clampByte(l * 255), clampByte(l * 255)]
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s
  const p = 2 * l - q
  const channel = (offset: number) => {
    let t = h + offset
    if (t < 0) t += 1
    if (t > 1) t -= 1
    if (t < 1 / 6) return p + (q - p) * 6 * t
    if (t < 1 / 2) return q
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6
    return p
  }
  return [clampByte(channel(1 / 3) * 255), clampByte(channel(0) * 255), clampByte(channel(-1 / 3) * 255)]
}

/** #rgb, #rrggbb, rgb() and hsl(); null for anything else (named colours, `inherit`). */
export function parseColor(input: string): Rgb | null {
  const value = input.trim().toLowerCase()
  const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/.exec(value)
  if (hex) {
    const digits = hex[1].length === 3 ? hex[1].replace(/./g, (char) => char + char) : hex[1]
    return [0, 2, 4].map((start) => parseInt(digits.slice(start, start + 2), 16)) as Rgb
  }
  const rgb = /^rgba?\(\s*([\d.]+)[\s,]+([\d.]+)[\s,]+([\d.]+)/.exec(value)
  if (rgb) return [clampByte(Number(rgb[1])), clampByte(Number(rgb[2])), clampByte(Number(rgb[3]))]
  const hsl = /^hsla?\(\s*([\d.]+)(?:deg)?[\s,]+([\d.]+)%[\s,]+([\d.]+)%/.exec(value)
  if (hsl) return hslToRgb(Number(hsl[1]), Number(hsl[2]), Number(hsl[3]))
  return null
}

export function toHex(rgb: Rgb): string {
  return `#${rgb.map((channel) => clampByte(channel).toString(16).padStart(2, '0')).join('')}`
}

export function relativeLuminance([r, g, b]: Rgb): number {
  const linear = (channel: number) => {
    const c = channel / 255
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b)
}

export function contrastRatio(a: Rgb | string, b: Rgb | string): number {
  const first = typeof a === 'string' ? parseColor(a) : a
  const second = typeof b === 'string' ? parseColor(b) : b
  if (!first || !second) return 1
  const [light, dark] = [relativeLuminance(first), relativeLuminance(second)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

function mix(from: Rgb, to: Rgb, amount: number): Rgb {
  return from.map((channel, index) => channel + (to[index] - channel) * amount) as Rgb
}

/**
 * `color` moved towards black or white -- away from the background -- just far
 * enough to reach `minimum` against `background`, so its hue still reads.
 * Colours that already pass, and ones that cannot be parsed, come back as is.
 */
export function ensureContrast(color: string, background: string, minimum = 4.5): string {
  const foreground = parseColor(color)
  const backdrop = parseColor(background)
  if (!foreground || !backdrop || contrastRatio(foreground, backdrop) >= minimum) return color
  const extreme: Rgb = relativeLuminance(backdrop) > 0.18 ? [0, 0, 0] : [255, 255, 255]
  let low = 0
  let high = 1
  for (let step = 0; step < 24; step += 1) {
    const middle = (low + high) / 2
    if (contrastRatio(mix(foreground, extreme, middle), backdrop) >= minimum) high = middle
    else low = middle
  }
  // Rounding to whole bytes can land a hair under the line; step past it.
  let result = mix(foreground, extreme, high).map(clampByte) as Rgb
  while (contrastRatio(result, backdrop) < minimum && high < 1) {
    high = Math.min(1, high + 0.01)
    result = mix(foreground, extreme, high).map(clampByte) as Rgb
  }
  return toHex(result)
}

/** A copy of a highlighter style sheet with every text colour held to `minimum`. */
export function withContrast<T extends Record<string, object>>(sheet: T, background: string, minimum = 4.5): T {
  const result: Record<string, object> = {}
  for (const [selector, rules] of Object.entries(sheet)) {
    const color = (rules as { color?: unknown }).color
    result[selector] = typeof color === 'string' ? { ...rules, color: ensureContrast(color, background, minimum) } : rules
  }
  return result as T
}
