/** Inline SVG icons: no icon font to load, and they inherit currentColor. */

interface IconProps {
  size?: number
  className?: string
}

function svg(path: React.ReactNode, viewBox = '0 0 16 16') {
  return function Icon({ size = 15, className }: IconProps) {
    return (
      <svg
        width={size}
        height={size}
        viewBox={viewBox}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
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

export const IconFolder = svg(<path d="M1.8 4.2a1 1 0 0 1 1-1h2.6l1.3 1.6h5.5a1 1 0 0 1 1 1v6a1 1 0 0 1-1 1H2.8a1 1 0 0 1-1-1z" />)
export const IconPlus = svg(<><path d="M8 3.2v9.6" /><path d="M3.2 8h9.6" /></>)
export const IconSend = svg(<><path d="M14 2 7 9" /><path d="M14 2 9.6 14l-2.6-5-5-2.6z" /></>)
export const IconTrash = svg(<><path d="M2.8 4.2h10.4" /><path d="M6.4 4.2V2.8h3.2v1.4" /><path d="M4 4.2l.6 8.4a1 1 0 0 0 1 .9h4.8a1 1 0 0 0 1-.9l.6-8.4" /></>)
export const IconCopy = svg(<><rect x="5.6" y="5.6" width="7.6" height="7.6" rx="1" /><path d="M10.4 3.6V3a1 1 0 0 0-1-1H3.8a1 1 0 0 0-1 1v5.6a1 1 0 0 0 1 1h.6" /></>)
export const IconClose = svg(<><path d="M4 4l8 8" /><path d="M12 4l-8 8" /></>)
export const IconChevronRight = svg(<path d="M6 3.5 10.5 8 6 12.5" />)
export const IconChevronDown = svg(<path d="M3.5 6 8 10.5 12.5 6" />)
export const IconSearch = svg(<><circle cx="7.2" cy="7.2" r="4.4" /><path d="m10.4 10.4 3 3" /></>)
export const IconSettings = svg(<><circle cx="8" cy="8" r="2.2" /><path d="M12.9 9.6a1 1 0 0 0 .2 1.1l.1.1a1.2 1.2 0 1 1-1.7 1.7l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9v.2a1.2 1.2 0 0 1-2.4 0v-.1a1 1 0 0 0-.7-.9 1 1 0 0 0-1.1.2l-.1.1a1.2 1.2 0 1 1-1.7-1.7l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6h-.2a1.2 1.2 0 0 1 0-2.4h.1a1 1 0 0 0 .9-.7 1 1 0 0 0-.2-1.1l-.1-.1a1.2 1.2 0 1 1 1.7-1.7l.1.1a1 1 0 0 0 1.1.2h.1a1 1 0 0 0 .6-.9v-.2a1.2 1.2 0 0 1 2.4 0v.1a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.2 1.2 0 1 1 1.7 1.7l-.1.1a1 1 0 0 0-.2 1.1v.1a1 1 0 0 0 .9.6h.2a1.2 1.2 0 0 1 0 2.4h-.1a1 1 0 0 0-.9.6z" /></>)
export const IconCloud = svg(<path d="M12.2 12.4H4.6A2.6 2.6 0 0 1 4.3 7.2a3.6 3.6 0 0 1 6.9-1.1 2.8 2.8 0 0 1 1 5.5z" />)
export const IconPlay = svg(<path d="M4.5 3.2 12.5 8l-8 4.8z" />)
export const IconDownload = svg(<><path d="M8 2.6v7.2" /><path d="M4.8 7.2 8 10.4l3.2-3.2" /><path d="M2.8 12.4h10.4" /></>)
export const IconUpload = svg(<><path d="M8 10.4V3.2" /><path d="M4.8 6.4 8 3.2l3.2 3.2" /><path d="M2.8 12.4h10.4" /></>)
export const IconCode = svg(<><path d="M5.6 11.2 2.4 8l3.2-3.2" /><path d="M10.4 4.8 13.6 8l-3.2 3.2" /></>)
export const IconDiff = svg(<><path d="M4.4 2.8v10.4" /><path d="M11.6 2.8v10.4" /><path d="M2.2 6h4.4" /><path d="M9.4 10h4.4" /></>)
export const IconSidebar = svg(<><rect x="2.2" y="2.8" width="11.6" height="10.4" rx="1" /><path d="M6.4 2.8v10.4" /></>)
export const IconMoon = svg(<path d="M13 9.4A5.4 5.4 0 0 1 6.6 3a5.6 5.6 0 1 0 6.4 6.4z" />)
export const IconSun = svg(<><circle cx="8" cy="8" r="3" /><path d="M8 1.6v1.4M8 13v1.4M3.5 3.5l1 1M11.5 11.5l1 1M1.6 8H3M13 8h1.4M3.5 12.5l1-1M11.5 4.5l1-1" /></>)
export const IconStop = svg(<rect x="4" y="4" width="8" height="8" rx="1" />)
export const IconSave = svg(<><path d="M3.4 2.8h7.2L13.2 5.4v7.8a1 1 0 0 1-1 1H3.4a1 1 0 0 1-1-1V3.8a1 1 0 0 1 1-1z" /><path d="M5.4 2.8v3.6h4.4V2.8" /><path d="M5.4 14.2v-3.8h5.2v3.8" /></>)
export const IconCheck = svg(<path d="M3.2 8.4 6.4 11.6l6.4-7.2" />)
export const IconLink = svg(<><path d="M6.6 9.4a2.6 2.6 0 0 0 3.8.2l1.8-1.8a2.6 2.6 0 0 0-3.7-3.7l-1 1" /><path d="M9.4 6.6a2.6 2.6 0 0 0-3.8-.2L3.8 8.2a2.6 2.6 0 0 0 3.7 3.7l1-1" /></>)
