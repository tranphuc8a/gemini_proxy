import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useEditorStore } from '../store'
import { useReadingStore } from '../readingStore'
import { extractHeadings, getDocumentStats, type Heading } from '../lib/markdown'
import { findNode } from '../lib/tree'
import {
  LINE_HEIGHT_OPTIONS,
  READING_FONT,
  READING_ID_PREFIX,
  THEME_OPTIONS,
  WIDTH_OPTIONS,
  activeHeadingIndex,
  measureFor,
  readingProgress,
  readingTimeLabel,
  type ReadingTheme
} from '../lib/reading'
import { useMediaQuery } from '../hooks/useMediaQuery'
import MarkdownView from './MarkdownView'
import Drawer from './Drawer'
import { IconClose, IconOutline } from './Icons'
import './ReadingView.css'

/** Mouse within this many px of the top brings the hidden bar back. */
const REVEAL_ZONE = 72
/** Scroll travel, in px, before the bar reacts to the direction. */
const SCROLL_DELTA = 6
/** Room kept above a heading scrolled to from the contents, for the bar. */
const HEADING_OFFSET = 72
/** The longest a jump may take before scrolling counts as the reader's again. */
const JUMP_SETTLE_MS = 2000
/** Jumps further than this many screens skip the smooth glide. */
const SMOOTH_JUMP_SCREENS = 3

/** Code backgrounds per theme, so syntax colours can be held to 4.5:1 (see ReadingView.css). */
const CODE_BACKGROUND: Record<ReadingTheme, string> = {
  light: '#f3f5f7',
  sepia: '#ede3cb',
  dark: '#1d2026'
}

function documentTitle(fileName: string | undefined, headings: Heading[]): string {
  if (fileName) return fileName.replace(/\.(md|markdown|txt)$/i, '')
  return headings.find((heading) => heading.level === 1)?.text ?? 'Untitled'
}

/**
 * Distraction-free reading of the open document: the rendered article alone,
 * centred, with a bar that steps aside while scrolling down and comes back on
 * the way up, on a tap, or when the pointer nears the top.
 *
 * It covers the app instead of replacing it, so leaving restores the previous
 * view exactly -- scroll positions, caret and all. Read-only by design: it
 * works for anonymous visitors, and task boxes cannot be ticked from here.
 */
function ReadingView() {
  const content = useEditorStore((state) => state.currentContent)
  const files = useEditorStore((state) => state.files)
  const currentFileId = useEditorStore((state) => state.currentFileId)

  const fontSize = useReadingStore((state) => state.fontSize)
  const lineHeight = useReadingStore((state) => state.lineHeight)
  const width = useReadingStore((state) => state.width)
  const theme = useReadingStore((state) => state.theme)
  const closeReading = useReadingStore((state) => state.closeReading)
  const stepFontSize = useReadingStore((state) => state.stepFontSize)
  const setLineHeight = useReadingStore((state) => state.setLineHeight)
  const setWidth = useReadingStore((state) => state.setWidth)
  const setReadingTheme = useReadingStore((state) => state.setReadingTheme)
  const resetReadingSettings = useReadingStore((state) => state.resetReadingSettings)

  const reducedMotion = useMediaQuery('(prefers-reduced-motion: reduce)')
  const scrollRef = useRef<HTMLDivElement>(null)
  const articleRef = useRef<HTMLElement>(null)
  const settingsRef = useRef<HTMLDivElement>(null)
  const settingsButtonRef = useRef<HTMLButtonElement>(null)
  const lastTop = useRef(0)
  const jumpingUntil = useRef(0)
  const jumpTarget = useRef(0)
  const frame = useRef(0)
  const pointerType = useRef('mouse')

  const [progress, setProgress] = useState(0)
  const [scrollable, setScrollable] = useState(false)
  const [barHidden, setBarHidden] = useState(false)
  const [panel, setPanel] = useState<'toc' | 'settings' | null>(null)
  const [activeIndex, setActiveIndex] = useState(-1)

  const headings = useMemo(() => extractHeadings(content), [content])
  // Indent relative to the shallowest heading, like the editor's outline.
  const baseLevel = headings.length ? Math.min(...headings.map((heading) => heading.level)) : 1
  const stats = useMemo(() => getDocumentStats(content), [content])
  const title = documentTitle(findNode(files, currentFileId)?.name, headings)

  /** The rendered element for an outline entry: by its slug, else by position. */
  const headingElement = useCallback((heading: Heading, index: number): HTMLElement | null => {
    const article = articleRef.current
    if (!article) return null
    const byId = Array.from(article.querySelectorAll<HTMLElement>('[id]')).find((element) => element.id === READING_ID_PREFIX + heading.slug)
    return byId ?? article.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6')[index] ?? null
  }, [])

  /** Looked up inside the article: the preview underneath has its own copies. */
  const elementById = (id: string): HTMLElement | null =>
    Array.from(articleRef.current?.querySelectorAll<HTMLElement>('[id]') ?? []).find((node) => node.id === id) ?? null

  const measure = useCallback(() => {
    const scroller = scrollRef.current
    if (!scroller) return
    const { scrollTop, scrollHeight, clientHeight } = scroller
    const value = readingProgress(scrollTop, scrollHeight, clientHeight)
    const canScroll = scrollHeight - clientHeight > 1
    setProgress(value)
    setScrollable(canScroll)

    const base = scroller.getBoundingClientRect().top - scrollTop
    const tops = headings.map((heading, index) => {
      const element = headingElement(heading, index)
      return element ? element.getBoundingClientRect().top - base : Number.POSITIVE_INFINITY
    })
    // The "reading line" sits a little below the bar.
    const line = scrollTop + Math.min(clientHeight * 0.3, 160)
    setActiveIndex(activeHeadingIndex(tops, line, canScroll && value >= 0.999))
  }, [headingElement, headings])

  // Images, diagrams and maths change the height as they finish rendering.
  useLayoutEffect(() => {
    measure()
    const article = articleRef.current
    if (!article) return
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame.current)
      frame.current = requestAnimationFrame(measure)
    })
    observer.observe(article)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame.current)
    }
  }, [measure, fontSize, lineHeight, width])

  // Focus goes to the article so arrows, Page Down and Space scroll it at
  // once; on the way out it goes back to whatever opened reading mode.
  useEffect(() => {
    const active = document.activeElement
    const previous = active instanceof HTMLElement && active !== document.body ? active : null
    scrollRef.current?.focus({ preventScroll: true })
    return () => {
      const target = previous?.isConnected ? previous : document.querySelector<HTMLElement>('[data-reading-trigger]')
      target?.focus({ preventScroll: true })
    }
  }, [])

  // Escape peels one layer at a time: an open panel first, then the mode.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape' || event.defaultPrevented) return
      event.preventDefault()
      if (panel === 'settings') {
        setPanel(null)
        settingsButtonRef.current?.focus()
        return
      }
      if (panel) {
        setPanel(null)
        return
      }
      closeReading()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [closeReading, panel])

  // The settings panel is a popover: a press anywhere else closes it.
  useEffect(() => {
    if (panel !== 'settings') return
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node
      if (settingsRef.current?.contains(target) || settingsButtonRef.current?.contains(target)) return
      setPanel(null)
    }
    document.addEventListener('pointerdown', onPointerDown)
    settingsRef.current?.focus({ preventScroll: true })
    return () => document.removeEventListener('pointerdown', onPointerDown)
  }, [panel])

  const onScroll = () => {
    const scroller = scrollRef.current
    if (!scroller) return
    const top = scroller.scrollTop
    const delta = top - lastTop.current
    if (Date.now() < jumpingUntil.current) {
      // A jump from the contents or a link is not the reader scrolling on:
      // the bar stays put so they can see where they landed.
      lastTop.current = top
      if (Math.abs(top - jumpTarget.current) <= 2) jumpingUntil.current = 0
    } else if (top <= REVEAL_ZONE) {
      setBarHidden(false)
      lastTop.current = top
    } else if (Math.abs(delta) >= SCROLL_DELTA) {
      // Down hides the bar, up brings it back.
      setBarHidden(delta > 0)
      lastTop.current = top
    }
    cancelAnimationFrame(frame.current)
    frame.current = requestAnimationFrame(measure)
  }

  const scrollToElement = (element: HTMLElement) => {
    const scroller = scrollRef.current
    if (!scroller) return
    const offset = element.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop - HEADING_OFFSET
    const top = Math.min(Math.max(0, offset), scroller.scrollHeight - scroller.clientHeight)
    // Gliding past a dozen screens is slow and says nothing; long jumps are instant.
    const smooth = !reducedMotion && Math.abs(top - scroller.scrollTop) < scroller.clientHeight * SMOOTH_JUMP_SCREENS
    jumpTarget.current = top
    jumpingUntil.current = Date.now() + (smooth ? JUMP_SETTLE_MS : 300)
    setBarHidden(false)
    scroller.scrollTo({ top, behavior: smooth ? 'smooth' : 'auto' })
    // Reading continues from the heading for keyboard and screen-reader users
    // too. Deferred so the closing drawer's focus hand-back does not win.
    if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '-1')
    requestAnimationFrame(() => element.focus({ preventScroll: true }))
  }

  const goToHeading = (heading: Heading, index: number) => {
    setPanel(null)
    const element = headingElement(heading, index)
    if (element) scrollToElement(element)
  }

  const onArticleClick = (event: React.MouseEvent<HTMLElement>) => {
    const target = event.target as HTMLElement
    // In-document links scroll this column; left alone they would jump to the
    // preview's copy of the heading underneath and rewrite the address.
    const link = target.closest<HTMLAnchorElement>('a[href^="#"]')
    if (link) {
      event.preventDefault()
      const id = decodeURIComponent(link.getAttribute('href')!.slice(1))
      // Headings carry the reading prefix; ids written into the document's own
      // HTML do not.
      const element = elementById(READING_ID_PREFIX + id) ?? elementById(id)
      if (element) scrollToElement(element)
      return
    }
    if (target instanceof HTMLInputElement && target.type === 'checkbox') {
      event.preventDefault()
      return
    }
    // A tap on the text toggles the bar; a mouse has the top edge for that.
    if (pointerType.current === 'mouse') return
    if (target.closest('a, button, input, select, textarea, summary, label')) return
    if (window.getSelection?.()?.toString()) return
    setBarHidden((hidden) => !hidden)
  }

  const barShown = !barHidden || panel !== null
  const style = {
    '--reading-font-size': `${fontSize}px`,
    '--reading-line-height': String(lineHeight),
    '--reading-measure': measureFor(width)
  } as React.CSSProperties
  const percent = Math.round(progress * 100)
  const timeLabel = readingTimeLabel(stats.readingMinutes, progress, scrollable)

  return (
    <div
      className={`reading${barShown ? '' : ' is-bar-hidden'}`}
      data-reading-theme={theme}
      style={style}
      // Modal over the (aria-hidden) app, dismissed with Esc like the others.
      role="dialog"
      aria-modal="true"
      aria-label={`Reading mode: ${title}`}
      onPointerMove={(event) => {
        if (event.pointerType === 'mouse' && event.clientY < REVEAL_ZONE) setBarHidden(false)
      }}
    >
      <div
        className="reading-progress"
        role="progressbar"
        aria-label="Reading progress"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${percent}% read`}
      >
        <div className="reading-progress-fill" style={{ transform: `scaleX(${progress})` }} />
      </div>

      <header className="reading-bar">
        <button className="reading-btn" onClick={closeReading} aria-label="Exit reading mode" title="Exit reading mode (Esc)">
          <IconClose size={18} />
        </button>
        {/* Not a heading: the article's own headings are the ones to navigate by. */}
        <div className="reading-heading">
          <p className="reading-title" title={title}>
            {title}
          </p>
          <p className="reading-time">{timeLabel}</p>
        </div>
        <button
          className={`reading-btn${panel === 'toc' ? ' is-active' : ''}`}
          onClick={() => setPanel((current) => (current === 'toc' ? null : 'toc'))}
          aria-label="Table of contents"
          aria-expanded={panel === 'toc'}
          aria-controls="reading-toc"
          title="Table of contents"
        >
          <IconOutline size={18} />
        </button>
        <button
          ref={settingsButtonRef}
          className={`reading-btn reading-btn-text${panel === 'settings' ? ' is-active' : ''}`}
          onClick={() => setPanel((current) => (current === 'settings' ? null : 'settings'))}
          aria-label="Reading settings"
          aria-expanded={panel === 'settings'}
          aria-controls="reading-settings"
          title="Text size, spacing, width and theme"
        >
          <span aria-hidden="true">Aa</span>
        </button>
      </header>

      <div ref={scrollRef} className="reading-scroll" tabIndex={-1} onScroll={onScroll}>
        <article
          ref={articleRef}
          className="markdown-body reading-article"
          aria-label={title}
          onPointerDown={(event) => {
            pointerType.current = event.pointerType
          }}
          onClick={onArticleClick}
        >
          <MarkdownView
            source={content}
            theme={theme === 'dark' ? 'dark' : 'light'}
            codeBackground={CODE_BACKGROUND[theme]}
            idPrefix={READING_ID_PREFIX}
          />
          {!content.trim() && <p className="preview-empty">This document is empty.</p>}
        </article>
        <p className="reading-end" aria-hidden="true">
          {stats.words.toLocaleString()} words · {stats.readingMinutes} min
        </p>
      </div>

      {panel === 'settings' && (
        <div
          ref={settingsRef}
          id="reading-settings"
          className="reading-settings"
          role="dialog"
          aria-label="Reading settings"
          tabIndex={-1}
          onBlur={(event) => {
            // Tabbing out of the popover closes it, so it never sits orphaned
            // behind the focus. A click on its own text blurs to nothing: ignored.
            const next = event.relatedTarget as Node | null
            if (next && !event.currentTarget.contains(next) && next !== settingsButtonRef.current) setPanel(null)
          }}
        >
          <div className="reading-setting">
            <span className="reading-setting-label" id="reading-size-label">
              Text size
            </span>
            <div className="reading-stepper" role="group" aria-labelledby="reading-size-label">
              <button
                className="reading-choice"
                onClick={() => stepFontSize(-1)}
                disabled={fontSize <= READING_FONT.min}
                aria-label="Decrease text size"
              >
                <span aria-hidden="true">A−</span>
              </button>
              <output className="reading-stepper-value" aria-live="polite">
                {fontSize}px
              </output>
              <button
                className="reading-choice reading-choice-large"
                onClick={() => stepFontSize(1)}
                disabled={fontSize >= READING_FONT.max}
                aria-label="Increase text size"
              >
                <span aria-hidden="true">A+</span>
              </button>
            </div>
          </div>

          <ChoiceGroup
            label="Line height"
            options={LINE_HEIGHT_OPTIONS.map((option) => ({ ...option, key: String(option.value) }))}
            isSelected={(option) => Math.abs(option.value - lineHeight) < 0.01}
            onSelect={(option) => setLineHeight(option.value)}
          />

          <ChoiceGroup
            label="Column width"
            options={WIDTH_OPTIONS.map((option) => ({ ...option, key: option.value }))}
            isSelected={(option) => option.value === width}
            onSelect={(option) => setWidth(option.value)}
          />

          <ChoiceGroup
            label="Theme"
            options={THEME_OPTIONS.map((option) => ({ ...option, key: option.value }))}
            isSelected={(option) => option.value === theme}
            onSelect={(option) => setReadingTheme(option.value)}
            swatches
          />

          <button className="reading-reset" onClick={resetReadingSettings}>
            Reset to defaults
          </button>
        </div>
      )}

      <Drawer open={panel === 'toc'} onClose={() => setPanel(null)} label="Table of contents" id="reading-toc" className="reading-toc">
        <div className="reading-toc-head">
          <h2>Contents</h2>
          <button className="reading-btn" onClick={() => setPanel(null)} aria-label="Close table of contents">
            <IconClose size={18} />
          </button>
        </div>
        {headings.length === 0 ? (
          <p className="reading-toc-empty">This document has no headings.</p>
        ) : (
          <nav aria-label="Table of contents">
            <ol className="reading-toc-list">
              {headings.map((heading, index) => (
                <li key={`${heading.line}-${heading.slug}`}>
                  <button
                    className={`reading-toc-item level-${heading.level}${index === activeIndex ? ' is-active' : ''}`}
                    style={{ paddingLeft: 12 + (heading.level - baseLevel) * 14 }}
                    aria-current={index === activeIndex ? 'location' : undefined}
                    onClick={() => goToHeading(heading, index)}
                  >
                    {heading.text}
                  </button>
                </li>
              ))}
            </ol>
          </nav>
        )}
      </Drawer>
    </div>
  )
}

interface ChoiceGroupProps<T extends { key: string; label: string }> {
  label: string
  options: T[]
  isSelected: (option: T) => boolean
  onSelect: (option: T) => void
  /** Draw each option as a sample of the theme it stands for. */
  swatches?: boolean
}

/** A row of mutually exclusive toggle buttons; the pressed one is the setting. */
function ChoiceGroup<T extends { key: string; label: string }>({ label, options, isSelected, onSelect, swatches = false }: ChoiceGroupProps<T>) {
  return (
    <div className="reading-setting">
      <span className="reading-setting-label">{label}</span>
      <div className={`reading-choices${swatches ? ' is-swatches' : ''}`} role="group" aria-label={label}>
        {options.map((option) => (
          <button
            key={option.key}
            className={`reading-choice${isSelected(option) ? ' is-active' : ''}${swatches ? ` swatch-${option.key}` : ''}`}
            aria-pressed={isSelected(option)}
            onClick={() => onSelect(option)}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  )
}

export default ReadingView
