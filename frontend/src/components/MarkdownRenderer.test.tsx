import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';
import {
  RENDER_VECTORS,
  STREAM_ANSWERS,
  countMaths,
  openDelimiterAt,
  streamCuts,
  textOf,
} from '../lib/__tests__/mathVectors';

// The real library needs a layout engine jsdom does not provide, and these tests
// are about what reaches the DOM, not about diagram rendering.
vi.mock('mermaid', () => ({
  default: {
    initialize: vi.fn(),
    render: vi.fn().mockResolvedValue({ svg: '<svg data-testid="diagram" />' }),
  },
}));

describe('MarkdownRenderer', () => {
  it('renders headings, emphasis and lists', () => {
    render(<MarkdownRenderer content={'# Title\n\n**bold** text\n\n- one\n- two'} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Title' })).toBeInTheDocument();
    expect(screen.getByText('bold').tagName).toBe('STRONG');
    expect(screen.getAllByRole('listitem')).toHaveLength(2);
  });

  it('renders a GitHub-flavoured table', () => {
    render(<MarkdownRenderer content={'| a | b |\n| - | - |\n| 1 | 2 |'} />);
    expect(screen.getByRole('table')).toBeInTheDocument();
  });

  it('keeps short backticks inline', () => {
    const { container } = render(<MarkdownRenderer content="use `npm run dev` to start" />);

    expect(container.querySelector('code')?.textContent).toBe('npm run dev');
    expect(container.querySelector('.code-block-wrapper')).toBeNull();
  });

  it('renders a fenced block with a language as a code block', () => {
    const { container } = render(<MarkdownRenderer content={'```ts\nconst a = 1;\n```'} />);

    expect(container.querySelector('.code-block-wrapper')).not.toBeNull();
    expect(screen.getByText('ts')).toBeInTheDocument();
  });

  it('renders a fenced block with no language as a code block too', () => {
    // Regression: inline-vs-block was decided by className alone, and a fence
    // without a language has none — so multi-line code rendered as inline code.
    const { container } = render(<MarkdownRenderer content={'```\nline one\nline two\n```'} />);

    expect(container.querySelector('.code-block-wrapper')).not.toBeNull();
  });

  it('does not execute raw HTML in message content', () => {
    // Message content is untrusted: it comes from a language model. Without
    // rehype-raw, react-markdown escapes it rather than mounting it.
    const { container } = render(
      <MarkdownRenderer content={'<img src="x" onerror="alert(1)"><script>alert(2)</script>'} />
    );

    expect(container.querySelector('script')).toBeNull();
    expect(container.querySelector('img')).toBeNull();
    expect(container.textContent).toContain('onerror');
  });

  it('opens links in a new tab without leaking the opener', () => {
    render(<MarkdownRenderer content="[docs](https://example.com)" />);

    const link = screen.getByRole('link', { name: 'docs' });
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noopener noreferrer');
  });

  it('renders nothing but stays mounted for empty content', () => {
    const { container } = render(<MarkdownRenderer content="" />);
    expect(container.querySelector('.markdown-body')).not.toBeNull();
  });

  /**
   * Maths as models write it (ke-hoach §1.5): the vectors Markdown Editor Pro renders, synced from its source
   * (scripts/sync-math.mjs). Rendered to static markup: quicker than mounting, and the KaTeX output is the same.
   */
  describe('maths', () => {
    const renderStatic = (md: string) => {
      const div = document.createElement('div');
      div.innerHTML = renderToStaticMarkup(<MarkdownRenderer content={md} />);
      return div;
    };

    it('runs the editor\'s render vectors', () => {
      expect(RENDER_VECTORS.length).toBeGreaterThanOrEqual(60);
    });

    it.each(RENDER_VECTORS)('$name', ({ md, display, inline, has, hasNot, check }) => {
      const root = renderStatic(md);
      expect(countMaths(root)).toEqual({ display, inline, errors: 0 });
      const text = textOf(root);
      for (const part of has ?? []) expect(text).toContain(part);
      for (const part of hasNot ?? []) expect(text).not.toContain(part);
      check?.(root);
    });

    it('still shows a KaTeX error for TeX it cannot render (the counter is not blind)', () => {
      expect(countMaths(renderStatic('$\\unknownmacro{x}$')).errors).toBeGreaterThan(0);
    });

    it('was broken before: \\( \\) and \\[ \\] render as maths, prices stay text', () => {
      const root = renderStatic('Energy \\( E = mc^2 \\) and\n\n\\[\n\\int_0^1 x\\,dx\n\\]\n\nIt costs $5 and $10.');
      expect(countMaths(root)).toEqual({ display: 1, inline: 1, errors: 0 });
      expect(textOf(root)).toContain('It costs $5 and $10.');
    });

    it.each(STREAM_ANSWERS)('streams in without swallowing text: $name', ({ md, display, inline }) => {
      expect(countMaths(renderStatic(md))).toEqual({ display, inline, errors: 0 });
      const before = new Map<number, ReturnType<typeof countMaths>>();
      for (const cut of streamCuts(md)) {
        const prefix = md.slice(0, cut);
        const counts = countMaths(renderStatic(prefix));
        expect(counts.errors, JSON.stringify(prefix)).toBe(0);
        const at = openDelimiterAt(prefix);
        if (at === -1) continue;
        if (!before.has(at)) before.set(at, countMaths(renderStatic(prefix.slice(0, at))));
        // An open \[ or \( is still text: it adds no formula and swallows none of what came before.
        expect(counts, JSON.stringify(prefix)).toEqual(before.get(at));
      }
    });

    it('keeps an open \\[ as text until its closer arrives, then shows the block', () => {
      const open = renderStatic('Ta có:\n\n\\[\nx^2 + 1');
      expect(countMaths(open).display).toBe(0);
      expect(open.textContent).toContain('x^2 + 1');
      const closed = renderStatic('Ta có:\n\n\\[\nx^2 + 1\n\\]');
      expect(countMaths(closed)).toEqual({ display: 1, inline: 0, errors: 0 });
    });

    it('a mounted message re-renders its maths as chunks arrive', () => {
      const { container, rerender } = render(<MarkdownRenderer content={'Nghiệm \\( x'} />);
      expect(container.querySelector('.katex')).toBeNull();
      rerender(<MarkdownRenderer content={'Nghiệm \\( x = 1 \\) và \\[ y'} />);
      expect(countMaths(container)).toEqual({ display: 0, inline: 1, errors: 0 });
      rerender(<MarkdownRenderer content={'Nghiệm \\( x = 1 \\) và \\[ y^2 \\]'} />);
      expect(countMaths(container)).toEqual({ display: 1, inline: 1, errors: 0 });
    });
  });

  describe('HTML preview', () => {
    const HTML = '<h1>Hello</h1>\n<p style="color: teal">World</p>';

    it('shows an HTML block in a frame that may run scripts but nothing more', async () => {
      const user = userEvent.setup();
      const { container } = render(<MarkdownRenderer content={'```html\n' + HTML + '\n```'} />);

      // Source first; the preview only on request.
      expect(container.querySelector('iframe')).toBeNull();
      const toggle = screen.getByRole('button', { name: /xem trước|preview/i });
      expect(toggle).toHaveAttribute('aria-pressed', 'false');

      await user.click(toggle);

      const frame = container.querySelector('iframe');
      expect(frame).not.toBeNull();
      // Exactly "allow-scripts": without allow-same-origin the markup runs in an
      // opaque origin and cannot reach this page, its storage or its cookies.
      expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
      expect(frame?.getAttribute('sandbox')).not.toMatch(/allow-same-origin|allow-forms|allow-popups|allow-top-navigation/);
      expect(frame).toHaveAttribute('srcdoc', HTML);
      expect(frame).toHaveAttribute('referrerpolicy', 'no-referrer');
      expect(frame?.getAttribute('title')).toBeTruthy();
      expect(toggle).toHaveAttribute('aria-pressed', 'true');

      // And back to the source.
      await user.click(toggle);
      expect(container.querySelector('iframe')).toBeNull();
    });

    it.each(['htm', 'svg', 'HTML'])('offers a preview for %s blocks too', (language) => {
      render(<MarkdownRenderer content={'```' + language + '\n<svg></svg>\n```'} />);
      expect(screen.getByRole('button', { name: /xem trước|preview/i })).toBeInTheDocument();
    });

    it('offers no preview for other languages', () => {
      render(<MarkdownRenderer content={'```js\nconsole.log(1)\n```'} />);
      expect(screen.queryByRole('button', { name: /xem trước|preview/i })).not.toBeInTheDocument();
    });
  });
});
