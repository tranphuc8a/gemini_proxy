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

/**
 * A mermaid diagram, rendered into its own container outside React's tree.
 *
 * The container stays mounted whether or not the last render succeeded. That is
 * the whole fix for "Không thể vẽ sơ đồ, hiển thị mã nguồn": the error branch
 * used to return different JSX, which unmounted the host div. The next effect
 * run then found `hostRef.current === null`, bailed out at the guard, and the
 * diagram was stuck showing its source **forever** — even once the code was
 * complete and valid. Since source arrives a character at a time while
 * streaming, mermaid is near-certain to fail at least once, so in practice
 * almost every diagram ended up in that dead end.
 *
 * Mermaid also leaves its probe element behind when parsing throws, which is
 * why each attempt uses a fresh id and the strays are swept up afterwards.
 */
const MermaidDiagram: React.FC<{ code: string; theme: 'dark' | 'light' }> = ({ code, theme }) => {
  const hostRef = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [rendered, setRendered] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    let cancelled = false;
    if (!code.trim()) return;

    configureMermaid(theme);

    // Debounced: most intermediate states of a streaming diagram are
    // syntactically invalid, and re-rendering each one flickers.
    const timer = window.setTimeout(() => {
      const id = `mermaid-${diagramSeq++}`;
      (async () => {
        try {
          // `parse` first, so a half-streamed diagram is recognised as
          // not-yet-valid without mermaid logging an error to the console.
          await mermaid.parse(code);
          const { svg } = await mermaid.render(id, code);
          if (cancelled || !hostRef.current) return;
          hostRef.current.innerHTML = svg;
          setRendered(true);
          setError(null);
        } catch (err: unknown) {
          if (cancelled) return;
          setError(err instanceof Error ? err.message : String(err));
        } finally {
          // mermaid appends a temporary element for measuring; it is orphaned
          // when rendering throws, and they accumulate over a long chat.
          document.getElementById(`d${id}`)?.remove();
        }
      })();
    }, 200);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, theme]);

  // The source is shown only while nothing has ever rendered. Once a diagram is
  // on screen a later failure leaves it there rather than replacing a good
  // picture with an error, which is what a reader of a finished message wants.
  const showSource = Boolean(error) && !rendered;

  return (
    <div className={`mermaid-diagram${showSource ? ' mermaid-diagram-error' : ''}`}>
      {showSource ? (
        <>
          <div className="mermaid-error-title">{t('chat.diagramError')}</div>
          <pre>{code}</pre>
        </>
      ) : null}
      {/* Never unmounted: the ref must survive a failed attempt, or no later
          attempt can ever find somewhere to draw. */}
      <div className="mermaid-host" ref={hostRef} hidden={showSource} />
    </div>
  );
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
