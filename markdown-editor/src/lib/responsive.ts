/**
 * Layout decisions for small screens and touch input.
 *
 * Every query below is phrased so that "nothing matches" means the desktop
 * layout. A browser without matchMedia -- and jsdom in the tests -- therefore
 * gets the unchanged desktop UI rather than a half-mobile one.
 */

export type Layout = 'phone' | 'tablet' | 'desktop'
/** How much of the header fits inline; whatever does not moves into the "⋯" menu. */
export type HeaderTier = 'compact' | 'medium' | 'full'
export type Pane = 'editor' | 'preview'

/** Portrait phones, plus phones held sideways (short and driven by touch). */
export const PHONE_QUERY = '(max-width: 767.98px), (pointer: coarse) and (max-height: 500px)'
/** Anything narrower than a desktop: the sidebar becomes an off-canvas drawer. */
export const COMPACT_QUERY = '(max-width: 1023.98px)'
/**
 * The header keeps only its essentials. Touch counts as narrower than it is,
 * because every control grows to a 40px tap target there.
 */
export const HEADER_COMPACT_QUERY = '(max-width: 767.98px), (pointer: coarse) and (max-width: 1023.98px)'
export const HEADER_MEDIUM_QUERY = '(max-width: 1023.98px), (pointer: coarse) and (max-width: 1279.98px)'
/** Where the split view stacks editor above preview. Must match App.css. */
export const STACKED_QUERY = '(max-width: 900px)'
/**
 * Where text fields render at 16px or more, because iOS zooms the page into
 * any smaller one on focus. Must match the media query in index.css.
 */
export const TOUCH_TEXT_QUERY = '(max-width: 767.98px), (pointer: coarse)'

export function resolveLayout(phone: boolean, compact: boolean): Layout {
  if (phone) return 'phone'
  return compact ? 'tablet' : 'desktop'
}

export function resolveHeaderTier(compact: boolean, medium: boolean): HeaderTier {
  if (compact) return 'compact'
  return medium ? 'medium' : 'full'
}

const TIER_RANK: Record<HeaderTier, number> = { compact: 0, medium: 1, full: 2 }

/** True when a control that fits from `inlineFrom` upwards stays in the header at `tier`. */
export function showsInline(tier: HeaderTier, inlineFrom: HeaderTier): boolean {
  return TIER_RANK[tier] >= TIER_RANK[inlineFrom]
}

/**
 * The pane a phone shows in the "Both" view, which has room for only one.
 * Until the reader picks one, visitors land on the rendered document and
 * administrators on the source they came to edit.
 */
export function resolvePhonePane(chosen: Pane | null, isAdmin: boolean): Pane {
  return chosen ?? (isAdmin ? 'editor' : 'preview')
}

/** Whether the split view collapses to one pane with a switch. */
export function isSinglePane(layout: Layout, viewMode: 'split' | 'editor' | 'preview'): boolean {
  return layout === 'phone' && viewMode === 'split'
}
