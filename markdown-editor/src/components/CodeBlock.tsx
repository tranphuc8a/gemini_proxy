import { useState } from 'react'
// The full `Prism` build bundles every grammar (~660 kB). The async-light
// build ships the core and fetches one grammar per language actually used.
import SyntaxHighlighter from 'react-syntax-highlighter/dist/esm/prism-async-light'
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism'
import { copyToClipboard } from '../lib/exporters'
import { IconCheck, IconCopy } from './Icons'

interface CodeBlockProps {
  language: string
  source: string
  theme: 'light' | 'dark'
}

function CodeBlock({ language, source, theme }: CodeBlockProps) {
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
        language={language}
        style={theme === 'dark' ? oneDark : oneLight}
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
