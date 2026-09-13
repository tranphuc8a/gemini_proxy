/** Inline SVG icons: no icon font, no extra request, and they inherit colour. */

interface IconProps {
  size?: number
  className?: string
}

function svg(path: React.ReactNode, viewBox = '0 0 16 16') {
  return function Icon({ size = 14, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={className}
        aria-hidden="true"
        focusable="false"
      >
        {path}
      </svg>
    )
  }
}

export const IconLeaf = svg(
  <>
    <path d="M8 14.5V6" />
    <path d="M8 14.5c3.6-1.6 4.8-5.2 4.2-9.2C11.8 2.6 10.2 1.5 8 1.5S4.2 2.6 3.8 5.3C3.2 9.3 4.4 12.9 8 14.5Z" />
  </>,
)

export const IconDatabase = svg(
  <>
    <ellipse cx="8" cy="3.5" rx="5.5" ry="2" />
    <path d="M2.5 3.5v9c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2v-9" />
    <path d="M2.5 8c0 1.1 2.5 2 5.5 2s5.5-.9 5.5-2" />
  </>,
)

export const IconCollection = svg(
  <>
    <rect x="2" y="2.5" width="12" height="11" rx="1.5" />
    <path d="M2 6h12M6 6v7.5" />
  </>,
)

export const IconView = svg(
  <>
    <path d="M1.5 8s2.4-4.5 6.5-4.5S14.5 8 14.5 8s-2.4 4.5-6.5 4.5S1.5 8 1.5 8Z" />
    <circle cx="8" cy="8" r="1.8" />
  </>,
)

export const IconChevron = svg(<path d="M6 3.5 10.5 8 6 12.5" />)

export const IconPlus = svg(<path d="M8 3.5v9M3.5 8h9" />)

export const IconTrash = svg(
  <>
    <path d="M2.5 4h11" />
    <path d="M5.5 4V2.5h5V4" />
    <path d="M4 4l.7 9.2c0 .7.6 1.3 1.3 1.3h4c.7 0 1.3-.6 1.3-1.3L12 4" />
  </>,
)

export const IconPencil = svg(
  <>
    <path d="M11.2 2.3 13.7 4.8 5.5 13H3v-2.5Z" />
    <path d="M10 3.5 12.5 6" />
  </>,
)

export const IconRefresh = svg(
  <>
    <path d="M13.5 8a5.5 5.5 0 1 1-1.7-4" />
    <path d="M13.5 1.5V4h-2.5" />
  </>,
)

export const IconSearch = svg(
  <>
    <circle cx="7" cy="7" r="4.5" />
    <path d="M10.5 10.5 14 14" />
  </>,
)

export const IconPlay = svg(<path d="M4.5 2.8v10.4L13 8Z" />)

export const IconDownload = svg(
  <>
    <path d="M8 2v8" />
    <path d="M4.5 7 8 10.5 11.5 7" />
    <path d="M2.5 12.5v1h11v-1" />
  </>,
)

export const IconCopy = svg(
  <>
    <rect x="5.5" y="5.5" width="8" height="8" rx="1.2" />
    <path d="M10.5 5.5v-2a1 1 0 0 0-1-1h-6a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2" />
  </>,
)

export const IconClose = svg(<path d="M4 4l8 8M12 4l-8 8" />)

export const IconKey = svg(
  <>
    <circle cx="5" cy="11" r="2.5" />
    <path d="M6.8 9.2 13 3h0M11 5l1.5 1.5M9.5 6.5 11 8" />
  </>,
)

export const IconServer = svg(
  <>
    <rect x="2" y="2.5" width="12" height="4.5" rx="1" />
    <rect x="2" y="9" width="12" height="4.5" rx="1" />
    <path d="M4.5 4.75h.01M4.5 11.25h.01" />
  </>,
)

export const IconChart = svg(
  <>
    <path d="M2.5 13.5h11" />
    <path d="M4.5 13.5V8M8 13.5V3.5M11.5 13.5v-4" />
  </>,
)

export const IconTheme = svg(
  <>
    <circle cx="8" cy="8" r="3.3" />
    <path d="M8 1.5v1.4M8 13.1v1.4M1.5 8h1.4M13.1 8h1.4M3.4 3.4l1 1M11.6 11.6l1 1M12.6 3.4l-1 1M4.4 11.6l-1 1" />
  </>,
)

export const IconLogout = svg(
  <>
    <path d="M6 2.5H3.5a1 1 0 0 0-1 1v9a1 1 0 0 0 1 1H6" />
    <path d="M10 11l3-3-3-3M13 8H6" />
  </>,
)

export const IconCode = svg(
  <>
    <path d="M5.5 5 2.5 8l3 3" />
    <path d="M10.5 5l3 3-3 3" />
  </>,
)
