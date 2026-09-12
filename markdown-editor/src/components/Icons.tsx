interface IconProps {
  size?: number
  className?: string
}

/** 16px line icons on a 24px grid, stroked so they inherit the text colour. */
function Svg({ size = 16, className, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  )
}

export const IconUndo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7v6h6" />
    <path d="M3 13a9 9 0 1 1 3 6.7" />
  </Svg>
)

export const IconRedo = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 7v6h-6" />
    <path d="M21 13a9 9 0 1 0-3 6.7" />
  </Svg>
)

export const IconBold = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4h7a4 4 0 0 1 0 8H6z" />
    <path d="M6 12h8a4 4 0 0 1 0 8H6z" />
  </Svg>
)

export const IconItalic = (p: IconProps) => (
  <Svg {...p}>
    <path d="M19 4h-9M14 20H5M15 4 9 20" />
  </Svg>
)

export const IconStrike = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h16" />
    <path d="M17 7a4 4 0 0 0-4-3h-2a3.5 3.5 0 0 0-1.6 6.6" />
    <path d="M7 17a4 4 0 0 0 4 3h2a3.5 3.5 0 0 0 2.5-6" />
  </Svg>
)

export const IconHeading = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 4v16M18 4v16M6 12h12" />
  </Svg>
)

export const IconQuote = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M4 12h10M4 18h10" />
    <path d="M18 11v8" strokeWidth={2.4} />
  </Svg>
)

export const IconCode = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 18-6-6 6-6M15 6l6 6-6 6" />
  </Svg>
)

export const IconLink = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 13a5 5 0 0 0 7.5.5l3-3a5 5 0 0 0-7-7l-1.7 1.7" />
    <path d="M14 11a5 5 0 0 0-7.5-.5l-3 3a5 5 0 0 0 7 7l1.7-1.7" />
  </Svg>
)

export const IconImage = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <circle cx="8.5" cy="9.5" r="1.5" />
    <path d="m21 16-5-5L5 20" />
  </Svg>
)

export const IconList = (p: IconProps) => (
  <Svg {...p}>
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </Svg>
)

export const IconOrderedList = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14h2v2H4v2h2" />
  </Svg>
)

export const IconTask = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="5" width="7" height="7" rx="1.5" />
    <path d="m4.5 8.5 1.6 1.6L9 7" />
    <path d="M14 8h7M14 16h7M3 16h7" />
  </Svg>
)

export const IconTable = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M3 10h18M9 10v10M15 10v10" />
  </Svg>
)

export const IconRule = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 12h16" />
  </Svg>
)

export const IconSearch = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="11" cy="11" r="7" />
    <path d="m20 20-3.5-3.5" />
  </Svg>
)

export const IconFile = (p: IconProps) => (
  <Svg {...p}>
    <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
    <path d="M14 3v5h5" />
  </Svg>
)

export const IconFolder = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
  </Svg>
)

export const IconFolderOpen = (p: IconProps) => (
  <Svg {...p}>
    <path d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V11" />
    <path d="M3 11h18l-2.2 7.3a2 2 0 0 1-1.9 1.7H5.4a2 2 0 0 1-1.9-1.4z" />
  </Svg>
)

export const IconChevron = (p: IconProps) => (
  <Svg {...p}>
    <path d="m9 6 6 6-6 6" />
  </Svg>
)

export const IconPlus = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 5v14M5 12h14" />
  </Svg>
)

export const IconTrash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 7h16M10 11v6M14 11v6" />
    <path d="M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2" />
  </Svg>
)

export const IconPencil = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 20h4L20 8a2.8 2.8 0 0 0-4-4L4 16z" />
    <path d="m14 6 4 4" />
  </Svg>
)

export const IconCopy = (p: IconProps) => (
  <Svg {...p}>
    <rect x="9" y="9" width="12" height="12" rx="2" />
    <path d="M5 15H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v1" />
  </Svg>
)

export const IconCheck = (p: IconProps) => (
  <Svg {...p}>
    <path d="m5 13 4 4L19 7" />
  </Svg>
)

export const IconSun = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
  </Svg>
)

export const IconMoon = (p: IconProps) => (
  <Svg {...p}>
    <path d="M21 13A9 9 0 1 1 11 3a7 7 0 0 0 10 10" />
  </Svg>
)

export const IconSidebar = (p: IconProps) => (
  <Svg {...p}>
    <rect x="3" y="4" width="18" height="16" rx="2" />
    <path d="M9 4v16" />
  </Svg>
)

export const IconExpand = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 9V4h5M20 15v5h-5M15 4h5v5M9 20H4v-5" />
  </Svg>
)

export const IconCollapse = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 4v5H4M15 20v-5h5M20 9h-5V4M4 15h5v5" />
  </Svg>
)

export const IconDownload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 3v12M7 11l5 5 5-5" />
    <path d="M4 19h16" />
  </Svg>
)

export const IconUpload = (p: IconProps) => (
  <Svg {...p}>
    <path d="M12 17V5M7 9l5-5 5 5" />
    <path d="M4 19h16" />
  </Svg>
)

export const IconCloud = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 19a4.5 4.5 0 0 1-.5-9 6 6 0 0 1 11.6 1.6A3.8 3.8 0 0 1 17.5 19z" />
  </Svg>
)

export const IconLock = (p: IconProps) => (
  <Svg {...p}>
    <rect x="4" y="10" width="16" height="11" rx="2" />
    <path d="M8 10V7a4 4 0 0 1 8 0v3" />
  </Svg>
)

export const IconEye = (p: IconProps) => (
  <Svg {...p}>
    <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7" />
    <circle cx="12" cy="12" r="3" />
  </Svg>
)

export const IconHelp = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="9" />
    <path d="M9.5 9.5A2.6 2.6 0 0 1 12 7.5c1.5 0 2.5 1 2.5 2.2 0 2-2.5 2.2-2.5 4M12 17h.01" />
  </Svg>
)

export const IconClose = (p: IconProps) => (
  <Svg {...p}>
    <path d="M6 6l12 12M18 6L6 18" />
  </Svg>
)

export const IconLink2 = (p: IconProps) => (
  <Svg {...p}>
    <path d="M9 12h6" />
    <path d="M11 8H8a4 4 0 0 0 0 8h3M13 8h3a4 4 0 0 1 0 8h-3" />
  </Svg>
)

export const IconMore = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="5" cy="12" r="1.3" fill="currentColor" />
    <circle cx="12" cy="12" r="1.3" fill="currentColor" />
    <circle cx="19" cy="12" r="1.3" fill="currentColor" />
  </Svg>
)

export const IconOutline = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h10M7 12h10M10 18h10" />
  </Svg>
)

export const IconHash = (p: IconProps) => (
  <Svg {...p}>
    <path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16" />
  </Svg>
)

export const IconPrinter = (p: IconProps) => (
  <Svg {...p}>
    <path d="M7 9V4h10v5" />
    <path d="M5 9h14a2 2 0 0 1 2 2v5h-4v4H7v-4H3v-5a2 2 0 0 1 2-2" />
  </Svg>
)

export const IconWrap = (p: IconProps) => (
  <Svg {...p}>
    <path d="M4 6h16M4 18h6" />
    <path d="M4 12h13a3 3 0 0 1 0 6h-3l2-2m-2 2 2 2" />
  </Svg>
)

export const IconNumbers = (p: IconProps) => (
  <Svg {...p}>
    <path d="M10 6h11M10 12h11M10 18h11M4 6h1v4M4 10h2M4 14h2v2H4v2h2" />
  </Svg>
)
