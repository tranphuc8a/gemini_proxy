import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ComponentProps } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PromptLibrary } from './PromptLibrary';
import { PROMPTS_STORAGE_KEY, usePromptStore, type SavedPrompt } from '../store/promptStore';
import i18n from '../i18n';

const TRANSLATE = /^(dịch sang tiếng anh|translate to english)$/i;

const openLibrary = async (props: Partial<ComponentProps<typeof PromptLibrary>> = {}) => {
  const onInsert = vi.fn();
  const user = userEvent.setup();
  render(<PromptLibrary currentInput="" onInsert={onInsert} {...props} />);
  await user.click(screen.getByRole('button', { name: /thư viện prompt|prompt library/i }));
  const drawer = await screen.findByRole('dialog');
  return { user, drawer, onInsert };
};

const seed = (prompts: SavedPrompt[]) => localStorage.setItem(PROMPTS_STORAGE_KEY, JSON.stringify(prompts));

beforeEach(() => {
  usePromptStore.setState({ prompts: [] });
});

describe('PromptLibrary', () => {
  it('lists the built-in templates by group', async () => {
    const { drawer } = await openLibrary();

    const groups = [/^viết|^writing/i, /^code$/i, /^học tập|^learning/i, /^dịch$|^translate$/i, /^phân tích|^analysis/i, /^tóm tắt|^summarize/i];
    for (const group of groups) {
      expect(within(drawer).getByRole('heading', { name: group })).toBeInTheDocument();
    }
    expect(within(drawer).getByRole('button', { name: TRANSLATE })).toBeInTheDocument();
  });

  it('hands a template to the message box and closes', async () => {
    const { user, drawer, onInsert } = await openLibrary();

    await user.click(within(drawer).getByRole('button', { name: TRANSLATE }));

    expect(onInsert).toHaveBeenCalledWith(i18n.t('prompts.templates.translateToEnglish.text'));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /thư viện prompt|prompt library/i })).toHaveAttribute(
        'aria-expanded',
        'false'
      )
    );
  });

  it('saves the message box as a prompt, then deletes it', async () => {
    const { user, drawer } = await openLibrary({ currentInput: '  Review my essay for tone  ' });
    expect(within(drawer).getByText(/chưa có prompt nào|no prompts yet/i)).toBeInTheDocument();

    await user.click(within(drawer).getByRole('button', { name: /lưu nội dung ô nhập|save the message box/i }));

    expect(await within(drawer).findByRole('button', { name: 'Review my essay for tone' })).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem(PROMPTS_STORAGE_KEY) ?? 'null')).toEqual([
      expect.objectContaining({ title: 'Review my essay for tone', text: 'Review my essay for tone' }),
    ]);

    await user.click(within(drawer).getByRole('button', { name: /xoá prompt|delete prompt/i }));

    await waitFor(() =>
      expect(within(drawer).queryByRole('button', { name: 'Review my essay for tone' })).not.toBeInTheDocument()
    );
    expect(JSON.parse(localStorage.getItem(PROMPTS_STORAGE_KEY) ?? 'null')).toEqual([]);
  });

  it('cannot save an empty message box', async () => {
    const { drawer } = await openLibrary({ currentInput: '   ' });
    expect(within(drawer).getByRole('button', { name: /lưu nội dung ô nhập|save the message box/i })).toBeDisabled();
  });

  it('reads saved prompts back from storage, and inserts one', async () => {
    seed([{ id: 'p1', title: 'Weekly report', text: 'Write my weekly report from these notes:', createdAt: 1 }]);
    const { user, drawer, onInsert } = await openLibrary();

    await user.click(within(drawer).getByRole('button', { name: 'Weekly report' }));

    expect(onInsert).toHaveBeenCalledWith('Write my weekly report from these notes:');
  });

  it('filters saved prompts and templates by title or text', async () => {
    seed([{ id: 'p1', title: 'Weekly report', text: 'Write my weekly report', createdAt: 1 }]);
    const { user, drawer } = await openLibrary();
    const search = within(drawer).getByRole('textbox', { name: /tìm prompt|search prompts/i });

    await user.type(search, 'weekly');
    expect(within(drawer).getByRole('button', { name: 'Weekly report' })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: TRANSLATE })).not.toBeInTheDocument();

    // Accents are optional when searching.
    await user.clear(search);
    await user.type(search, 'dich sang');
    expect(within(drawer).getByRole('button', { name: TRANSLATE })).toBeInTheDocument();
    expect(within(drawer).queryByRole('button', { name: 'Weekly report' })).not.toBeInTheDocument();

    await user.clear(search);
    await user.type(search, 'zzzz');
    expect(within(drawer).getByText(/không có prompt phù hợp|no prompts match/i)).toBeInTheDocument();
  });
});
