import React, { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { oneDark, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import { Button, message } from 'antd';
import { CopyOutlined, CheckOutlined } from '@ant-design/icons';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import rehypeRaw from 'rehype-raw';
import mermaid from 'mermaid';
import 'katex/dist/katex.min.css';
import { useAppStore } from '../store/appStore';

interface MarkdownRendererProps {
  content: string;
}

// Initialize mermaid
mermaid.initialize({
  startOnLoad: false,
  theme: 'default',
  securityLevel: 'loose',
});

// Code block component with copy button
const CodeBlock: React.FC<{ code: string; language: string; theme: 'dark' | 'light' }> = ({ code, language, theme }) => {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      message.error('Failed to copy');
    }
  };

  return (
    <div className="code-block-wrapper">
      <div className="code-block-header">
        <span className="code-block-language">{language}</span>
        <Button
          type="text"
          size="small"
          icon={copied ? <CheckOutlined /> : <CopyOutlined />}
          onClick={handleCopy}
          className="code-block-copy-btn"
        >
          {copied ? 'Copied!' : 'Copy'}
        </Button>
      </div>
      <SyntaxHighlighter
        style={(theme === 'dark' ? oneDark : oneLight) as any}
        language={language}
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

export const MarkdownRenderer: React.FC<MarkdownRendererProps> = ({ content }) => {
  const theme = useAppStore((state) => state.theme);
  const mermaidRef = useRef<number>(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Re-render mermaid diagrams when content or theme changes
    mermaid.initialize({
      theme: theme === 'dark' ? 'dark' : 'default',
      securityLevel: 'loose',
      startOnLoad: false,
    });
    
    // Trigger mermaid rendering
    const renderMermaid = async () => {
      if (!containerRef.current) return;
      
      // Find all unprocessed mermaid diagrams within this component
      const mermaidElements = containerRef.current.querySelectorAll('.mermaid-diagram:not([data-processed="true"])');
      
      for (const element of Array.from(mermaidElements)) {
        try {
          const code = element.textContent || '';
          if (!code.trim()) continue;
          
          const id = `mermaid-${Date.now()}-${mermaidRef.current++}`;
          const { svg } = await mermaid.render(id, code);
          element.innerHTML = svg;
          element.setAttribute('data-processed', 'true');
        } catch (error) {
          console.error('Mermaid rendering error:', error);
          element.innerHTML = `<pre style="color: red;">Error rendering diagram</pre>`;
          element.setAttribute('data-processed', 'error');
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(renderMermaid, 100);
    return () => clearTimeout(timer);
  }, [content, theme]);

  return (
    <div className="markdown-body" ref={containerRef}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkMath]}
        rehypePlugins={[rehypeKatex, rehypeRaw]}
        components={{
          code(props) {
            const { children, className } = props;
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : '';
            const isInline = !className;

            // Check if it's a mermaid diagram
            if (!isInline && language === 'mermaid') {
              return (
                <div className="mermaid-diagram" data-processed="false">
                  {String(children).replace(/\n$/, '')}
                </div>
              );
            }

            // Regular code block
            if (!isInline && language) {
              return (
                <CodeBlock 
                  code={String(children).replace(/\n$/, '')} 
                  language={language} 
                  theme={theme}
                />
              );
            }

            // Inline code
            return (
              <code className={className}>
                {children}
              </code>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
};
