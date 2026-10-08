import { useState } from 'react'
// The full `Prism` build bundles every grammar (~660 kB). The async-light
// build ships the core and fetches one grammar per language actually used.
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-async-light'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { copyToClipboard } from '../lib/exporters'
import { withContrast } from '../lib/contrast'
import { prismLanguage } from '../lib/codeLanguages'
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

/** One adjusted sheet per theme and background, shared by every block. */
const adjusted = new Map<string, typeof oneLight>()

function styleFor(theme: 'light' | 'dark', background?: string) {
  const base = theme === 'dark' ? oneDark : oneLight
  if (!background) return base
  const key = `${theme}|${background}`
  let sheet = adjusted.get(key)
  if (!sheet) {
    sheet = withContrast(base, background)
    adjusted.set(key, sheet)
  }
  return sheet
}

function CodeBlock({ language, source, theme, contrastBackground }: CodeBlockProps) {
  const [copied, setCopied] = useState<'idle' | 'ok' | 'fail'>('idle')

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
        style={styleFor(theme, contrastBackground)}
        PreTag="div"
        customStyle={{ margin: 0, background: 'transparent', padding: '14px 16px', fontSize: '0.85em' }}
        codeTagProps={{ style: { fontFamily: 'var(--font-mono)' } }}
      >
        {source}
      </SyntaxHighlighter>
    </div>
  )
}

export default CodeBlock
