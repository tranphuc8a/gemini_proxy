import React, { memo, useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';
import { useAppStore } from '../store/appStore';
import { showToast } from '../utils/toast';

interface MarkdownRendererProps {
  content: string;
}

/**
 * Configure mermaid once per theme, at module scope.
 *
 * Doing this inside the component re-initialised a global singleton on every
 * mount and on every streamed chunk, which is both wasteful and racy when
 * several messages render at once.
 *
 * `securityLevel: 'strict'` matters: diagram source arrives from the model, and
 * 'loose' lets a diagram inject HTML and click handlers into the page.
 */
let configuredTheme: 'dark' | 'light' | null = null;

const configureMermaid = (theme: 'dark' | 'light') => {
  if (configuredTheme === theme) return;
  mermaid.initialize({
    startOnLoad: false,
    theme: theme === 'dark' ? 'dark' : 'default',
    securityLevel: 'strict',
  });
  configuredTheme = theme;
};

let diagramSeq = 0;

// Code block component with copy button
const CodeBlock: React.FC<{ code: string; language: string; theme: 'dark' | 'light' }> = ({ code, language, theme }) => {
  const { t } = useTranslation();
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast.error(t('chat.copyFailed'));
    }
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-language">{language || t('chat.plainText')}</span>
        <Button
          type="text"
          size="small"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopy}
          className="code-block-copy-btn"
        >
          {copied ? t('chat.copied') : t('common.copy')}
        </Button>
      </div>
      <SyntaxHighlighter
        style={theme === 'dark' ? oneDark : oneLight}
        language={language || 'text'}
        PreTag="div"
        showLineNumbers
        customStyle={{
          margin: 0,
          borderRadius: '0 0 6px 6px',
        }}
      >
        {code}
      </SyntaxHighlighter>
    </div>
  );
};

/** A mermaid diagram, rendered into its own container outside React's tree. */
const MermaidDiagram: React.FC<{ code: string; theme: 'dark' | 'light' }> = ({ code, theme }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    const host = hostRef.current;
    if (!host || !code.trim()) return;

    configureMermaid(theme);

    // Diagram source arrives a character at a time while streaming, so most
    // intermediate states are syntactically invalid. Debouncing avoids flashing
    // an error for every keystroke of the model's output.
    const timer = window.setTimeout(() => {
      mermaid
        .render(`mermaid-${diagramSeq++}`, code)
        .then(({ svg }) => {
          if (cancelled || !hostRef.current) return;
          hostRef.current.innerHTML = svg;
          setError(null);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        });
    }, 150);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, theme]);

  if (error) {
    return (
      <div className="mermaid-diagram mermaid-diagram-error">
        <div className="mermaid-error-title">{t('chat.diagramError')}</div>
        <pre>{code}</pre>
      </div>
    );
  }

  return <div className="mermaid-diagram" ref={hostRef} />;
};

/**
 * Renders assistant and user content as Markdown.
 *
 * Raw HTML is deliberately *not* enabled (no rehype-raw): message content is
 * untrusted — it comes from a language model, or from whatever another user
 * typed — and react-markdown escapes HTML by default, which is what keeps a
 * `<script>` or an `onerror=` attribute inert here.
 *
 * Memoised on content: streaming re-renders the message list on every chunk, and
 * re-parsing every sibling message's Markdown each time is what made long
 * answers stutter.
 */
const MarkdownRendererInner: React.FC<MarkdownRendererProps> = ({ content }) => {
  const theme = useAppStore((state) => state.theme);

  return (
    <div className="markdown-body">
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex]}
        components={{
          code(props) {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const text = String(children).replace(/\n$/, '');

            // react-markdown gives a fenced block no className when the fence
            // carries no language, so className alone cannot tell inline code
            // from a bare ``` block. A newline can: inline code never has one.
            const isInline = !className && !text.includes('\n');

            if (isInline) {
              return <code className={className}>{children}</code>;
            }

            if (language === 'mermaid') {
              return <MermaidDiagram code={text} theme={theme} />;
            }

            return <CodeBlock code={text} language={language} theme={theme} />;
          },
          // Model output routinely links out; open those in a new tab rather
          // than navigating the chat away, and drop the opener reference.
          a(props) {
            return <a {...props} target="_blank" rel="noopener noreferrer" />;
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};

export const MarkdownRenderer = memo(MarkdownRendererInner);
