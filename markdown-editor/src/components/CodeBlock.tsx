import { memo, useState } from 'react'
// The full `Prism` build bundles every grammar (~660 kB). The async-light
// build ships the core and fetches one grammar per language actually used.
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-async-light'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { copyToClipboard } from '../lib/exporters'
import { withContrast } from '../lib/contrast'
import { prismLanguage } from '../lib/codeLanguages'
import { PrismSheet, prismRenderer, prismScope } from '../lib/prismCss'
import { IconCheck, IconCopy } from './Icons'

interface CodeBlockProps {
  language: string
  source: string
  theme: 'light' | 'dark'
  /**
   * The colour the code sits on. When given, token colours are adjusted to
   * 4.5:1 against it (reading mode); without it the stock theme is used as is.
   */
  contrastBackground?: string
  /** File name announced by the fence (```` ```python title="main.py" ````), shown next to the language. */
  fileName?: string
}

/** One sheet per theme and background, shared by every block. */
const sheets = new Map<string, PrismSheet>()
/** Scope class → the theme|background it was made for, so two backgrounds never share one. */
const scopeOwners = new Map<string, string>()

function sheetFor(theme: 'light' | 'dark', background?: string): PrismSheet {
  const key = `${theme}|${background ?? ''}`
  let sheet = sheets.get(key)
  if (!sheet) {
    const base = theme === 'dark' ? oneDark : oneLight
    let scope = prismScope(theme, background)
    // Distinct colours that read alike once reduced to a class name get a suffix.
    for (let n = 2; scopeOwners.has(scope) && scopeOwners.get(scope) !== key; n += 1) scope = `${prismScope(theme, background)}-${n}`
    scopeOwners.set(scope, key)
    sheet = new PrismSheet(background ? withContrast(base, background) : base, scope)
    sheets.set(key, sheet)
  }
  return sheet
}

const CUSTOM_STYLE = { margin: 0, background: 'transparent', padding: '14px 16px', fontSize: '0.85em' }

/**
 * A highlighted code block. Tokens carry classes (`span.token.keyword`) plus
 * one rule class holding the style inline mode would have given them (see
 * lib/prismCss) -- inline styles cost ~0.3 ms per token to compute.
 * Memoised: a preview render re-highlights only the blocks whose code changed.
 */
function CodeBlock({ language, source, theme, contrastBackground, fileName }: CodeBlockProps) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')
  const sheet = sheetFor(theme, contrastBackground)

  const onCopy = async () => {
    const ok = await copyToClipboard(source)
    setCopied(ok ? 'ok' : 'fail')
    setTimeout(() => setCopied('idle'), 1600)
  }

  return (
    <div className="code-block">
      <div className="code-block-bar">
        <span className="code-block-lang">{language}</span>
        {fileName ? <span className="code-block-file" title={fileName}>{fileName}</span> : null}
        <button
          type="button"
          className={`code-copy${copied === 'ok' ? ' is-ok' : ''}${copied === 'fail' ? ' is-fail' : ''}`}
          onClick={() => void onCopy()}
          title="Copy code"
        >
          {copied === 'ok' ? <IconCheck size={13} /> : <IconCopy size={13} />}
          {copied === 'ok' ? 'Copied' : copied === 'fail' ? 'Blocked' : 'Copy'}
        </button>
      </div>
      <SyntaxHighlighter
        language={prismLanguage(language)}
        useInlineStyles={false}
        className={sheet.scope}
        renderer={prismRenderer(sheet)}
        // A renderer turns line wrapping on unless told otherwise; the stock one ran without it.
        wrapLines={false}
        PreTag="div"
        customStyle={CUSTOM_STYLE}
        // Fresh each render: the highlighter writes into codeTagProps.style.
        codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
      >
        {source}
      </SyntaxHighlighter>
    </div>
  )
}

export default memo(CodeBlock)
