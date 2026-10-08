import { useMediaQuery } from './useMediaQuery'
import {
  COMPACT_QUERY,
  HEADER_COMPACT_QUERY,
  HEADER_MEDIUM_QUERY,
  PHONE_QUERY,
  resolveHeaderTier,
  resolveLayout,
  type HeaderTier,
  type Layout
} from '../lib/responsive'

export interface Viewport {
  layout: Layout
  headerTier: HeaderTier
}

export function useViewport(): Viewport {
  const phone = useMediaQuery(PHONE_QUERY)
  const compact = useMediaQuery(COMPACT_QUERY)
  const headerCompact = useMediaQuery(HEADER_COMPACT_QUERY)
  const headerMedium = useMediaQuery(HEADER_MEDIUM_QUERY)
  return {
    layout: resolveLayout(phone, compact),
    headerTier: resolveHeaderTier(headerCompact, headerMedium)
  }
}
