import { memo, useState } from 'react'
// The full `Prism` build bundles every grammar (~660 kB). The async-light
// build ships the core and fetches one grammar per language actually used.
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-async-light'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { copyToClipboard } from '../lib/exporters'
import { withContrast } from '../lib/contrast'
import { prismLanguage } from '../lib/codeLanguages'
import { ensurePrismSheet, prismScope, prismThemeToCss } from '../lib/prismCss'
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
}

/** One scope class per theme and background, its stylesheet installed on first use. */
const scopes = new Map<string, string>()

function scopeFor(theme: 'light' | 'dark', background?: string): string {
  const key = `${theme}|${background ?? ''}`
  let scope = scopes.get(key)
  if (!scope) {
    const base = theme === 'dark' ? oneDark : oneLight
    const sheet = background ? withContrast(base, background) : base
    scope = prismScope(theme, background)
    ensurePrismSheet(scope, prismThemeToCss(sheet, scope))
    scopes.set(key, scope)
  }
  return scope
}

const CUSTOM_STYLE = { margin: 0, background: 'transparent', padding: '14px 16px', fontSize: '0.85em' }

/**
 * A highlighted code block. Tokens carry classes (`span.token.keyword`) and a
 * per-theme stylesheet colours them -- inline styles cost ~0.3 ms per token.
 * Memoised: a preview render re-highlights only the blocks whose code changed.
 */
function CodeBlock({ language, source, theme, contrastBackground }: CodeBlockProps) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')
  const scope = scopeFor(theme, contrastBackground)

  const onCopy = async () => {
    const ok = await copyToClipboard(source)
    setCopied(ok ? 'ok' : 'fail')
    setTimeout(() => setCopied('idle'), 1600)
  }

  return (
    <div className="code-block">
      <div className="code-block-bar">
        <span className="code-block-lang">{language}</span>
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
        className={scope}
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
