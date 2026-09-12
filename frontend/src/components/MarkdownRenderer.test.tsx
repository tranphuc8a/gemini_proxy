import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { MarkdownRenderer } from './MarkdownRenderer';

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
});
