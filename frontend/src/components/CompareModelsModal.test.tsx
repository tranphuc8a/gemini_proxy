import { act, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState, type FC } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { CompareModelsModal } from './CompareModelsModal';
import { aiRoot, aiSessionKey, type AiStatus } from '../services/aiService';
import { BASE_URL } from '../services/apiClient';

// MarkdownRenderer pulls mermaid in; the real library needs a layout engine.
vi.mock('mermaid', () => ({
  default: { initialize: vi.fn(), render: vi.fn().mockResolvedValue({ svg: '<svg />' }) },
}));

const ALLOWED: AiStatus = {
  enabled: true,
  access: 'public',
  allowed: true,
  needs: null,
  admin: false,
  model: 'gemini-2.5-flash',
  limits: { perMinute: 5, perDay: 100 },
};
const NEEDS_CODE: AiStatus = { ...ALLOWED, access: 'code', allowed: false, needs: 'code' };

/** GET /ai/models as the server answers it: its default first, newest after. */
const model = (id: string, label: string, extra: Record<string, unknown> = {}) => ({
  id, label, tier: 'flash', preview: false, alias: false, adminOnly: false, default: false, allowed: true, ...extra,
});
const MODELS = {
  default: 'gemini-2.5-flash',
  source: 'api',
  admin: false,
  models: [
    model('gemini-2.5-flash', 'Gemini 2.5 Flash', { default: true }),
    model('gemini-2.5-pro', 'Gemini 2.5 Pro', { tier: 'pro' }),
    model('gemini-3.8-flash', 'Gemini 3.8 Flash'),
    model('gemini-3.1-pro-preview', 'Gemini 3.1 Pro Preview', { tier: 'pro', preview: true, adminOnly: true, allowed: false }),
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

const answerFor = (model: string) => ({
  model,
  text: `Answer from ${model}`,
  ms: model === 'gemini-2.5-flash' ? 800 : 2300,
  promptTokens: 5,
  outputTokens: model === 'gemini-2.5-flash' ? 42 : 120,
  finishReason: 'STOP',
});

/**
 * A stand-in gateway. Answers to /ai/chat are held until `release()`, so a test
 * can see both requests in flight at once.
 */
const stubGateway = ({
  chat = (model: string) => json(answerFor(model)),
  status = ALLOWED,
}: { chat?: (model: string) => Response; status?: AiStatus } = {}) => {
  const held: Array<() => void> = [];
  const spy = vi.fn<typeof fetch>((input, init) => {
    const url = String(input);
    if (url.endsWith('/ai/chat')) {
      const { model } = JSON.parse(String(init?.body)) as { model: string };
      return new Promise<Response>((resolve) => held.push(() => resolve(chat(model))));
    }
    if (url.endsWith('/ai/status')) return Promise.resolve(json(status));
    if (url.endsWith('/ai/models')) return Promise.resolve(json(MODELS));
    return Promise.reject(new Error(`unexpected request to ${url}`));
  });
  vi.stubGlobal('fetch', spy);

  return {
    spy,
    chatBodies: () =>
      spy.mock.calls
        .filter(([input]) => String(input).endsWith('/ai/chat'))
        .map(([, init]) => JSON.parse(String(init?.body)) as { prompt: string; model: string }),
    release: () => act(async () => held.splice(0).forEach((resolve) => resolve())),
  };
};

/** The modal as the chat uses it: it owns the status the modal reports back. */
const Harness: FC<{
  status: AiStatus | null;
  initialPrompt?: string;
  onStatusChange?: (status: AiStatus | null) => void;
}> = ({ status: initialStatus, initialPrompt = 'Explain closures', onStatusChange }) => {
  const [status, setStatus] = useState(initialStatus);
  return (
    <CompareModelsModal
      open
      onClose={() => undefined}
      initialPrompt={initialPrompt}
      status={status}
      onStatusChange={(next) => {
        onStatusChange?.(next);
        setStatus(next);
      }}
    />
  );
};

/**
 * The Compare button. While busy antd prefixes its name with the spinner's
 * "loading" — and in jsdom the spinner never finishes its exit transition, so
 * the prefix can outlive the busy state.
 */
const runButton = (dialog: HTMLElement) =>
  within(dialog).getByRole('button', { name: /^(loading\s*)?(so sánh|compare)$/i });

/** Pick `label` in the model picker named `name`. */
const pickModel = async (user: ReturnType<typeof userEvent.setup>, dialog: HTMLElement, name: RegExp, label: string) => {
  await user.click(within(dialog).getByRole('combobox', { name }));
  const option = await waitFor(() => {
    const element = document.querySelector<HTMLElement>(
      `.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title="${label}"]`
    );
    if (!element) throw new Error(`option ${label} is not shown`);
    return element;
  });
  await user.click(option);
};

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('CompareModelsModal', () => {
  it('sends the prompt to both chosen models at once and shows each answer', async () => {
    const gateway = stubGateway();
    const user = userEvent.setup();
    render(<Harness status={ALLOWED} />);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('textbox', { name: /câu hỏi|prompt/i })).toHaveValue('Explain closures');

    await pickModel(user, dialog, /model thứ hai|second model/i, 'Gemini 3.8 Flash');
    await user.click(runButton(dialog));

    // Both requests are out before either has answered: side by side, not one after the other.
    await waitFor(() => expect(gateway.chatBodies()).toHaveLength(2));
    expect(gateway.chatBodies()).toEqual([
      { prompt: 'Explain closures', model: 'gemini-2.5-flash' },
      { prompt: 'Explain closures', model: 'gemini-3.8-flash' },
    ]);
    expect(within(dialog).getAllByRole('status')).toHaveLength(2);

    await gateway.release();

    expect(await within(dialog).findByText('Answer from gemini-2.5-flash')).toBeInTheDocument();
    expect(within(dialog).getByText('Answer from gemini-3.8-flash')).toBeInTheDocument();
    expect(within(dialog).getByText(/^800 ms · 42 tokens?$/)).toBeInTheDocument();
    expect(within(dialog).getByText(/^2300 ms · 120 tokens?$/)).toBeInTheDocument();
  });

  it('keeps a failure to its own column, with the server message', async () => {
    const gateway = stubGateway({
      chat: (model) =>
        model === 'gemini-2.5-pro'
          ? json(
              {
                status_code: 429,
                message: 'Bạn hỏi AI nhanh quá — thử lại sau 12 giây',
                data: { code: 'ai_rate_limited', retryAfter: 12 },
              },
              429
            )
          : json(answerFor(model)),
    });
    const user = userEvent.setup();
    render(<Harness status={ALLOWED} />);

    const dialog = await screen.findByRole('dialog');
    await user.click(runButton(dialog));
    await waitFor(() => expect(gateway.chatBodies()).toHaveLength(2));
    await gateway.release();

    expect(await within(dialog).findByText('Bạn hỏi AI nhanh quá — thử lại sau 12 giây')).toBeInTheDocument();
    expect(within(dialog).getByText('Answer from gemini-2.5-flash')).toBeInTheDocument();
  });

  it("offers the server's models, with an administrator's model shown but not pickable", async () => {
    stubGateway();
    const user = userEvent.setup();
    render(<Harness status={ALLOWED} />);

    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: /model thứ hai|second model/i }));
    const option = await waitFor(() => {
      const element = document.querySelector<HTMLElement>(
        '.ant-select-dropdown:not(.ant-select-dropdown-hidden) .ant-select-item-option[title^="Gemini 3.1 Pro Preview"]'
      );
      if (!element) throw new Error('the Pro preview model is not listed');
      return element;
    });
    expect(option.getAttribute('title')).toMatch(/xem trước|preview/i);
    expect(option.getAttribute('title')).toMatch(/quản trị|admin/i);
    expect(option).toHaveClass('ant-select-item-option-disabled');
  });

  it('will not compare with an empty prompt, or a model with itself', async () => {
    const gateway = stubGateway();
    const user = userEvent.setup();
    render(<Harness status={ALLOWED} initialPrompt="" />);

    const dialog = await screen.findByRole('dialog');
    expect(runButton(dialog)).toBeDisabled();

    await user.type(within(dialog).getByRole('textbox', { name: /câu hỏi|prompt/i }), 'Hi');
    expect(runButton(dialog)).toBeEnabled();

    await pickModel(user, dialog, /model thứ hai|second model/i, 'Gemini 2.5 Flash');
    expect(runButton(dialog)).toBeDisabled();
    expect(within(dialog).getByText(/hai model khác nhau|two different models/i)).toBeInTheDocument();
    expect(gateway.chatBodies()).toHaveLength(0);
  });

  it('asks for the access code when the gateway wants one, then unlocks', async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 3600;
    const spy = vi.fn<typeof fetch>(async (input) => {
      const url = String(input);
      if (url.endsWith('/ai/session')) return json({ ok: true, session: 'ai-token', expiresAt });
      if (url.endsWith('/ai/status')) return json(ALLOWED);
      if (url.endsWith('/ai/models')) return json(MODELS);
      throw new Error(`unexpected request to ${url}`);
    });
    vi.stubGlobal('fetch', spy);
    const onStatusChange = vi.fn();
    const user = userEvent.setup();
    render(<Harness status={NEEDS_CODE} onStatusChange={onStatusChange} />);

    const dialog = await screen.findByRole('dialog');
    expect(runButton(dialog)).toBeDisabled();

    await user.type(within(dialog).getByLabelText(/mã truy cập ai|ai access code/i), 'open-sesame');
    await user.click(within(dialog).getByRole('button', { name: /mở kho|unlock/i }));

    await waitFor(() => expect(onStatusChange).toHaveBeenCalledWith(ALLOWED));
    const session = spy.mock.calls.find(([input]) => /\/ai\/session$/.test(String(input)));
    expect(JSON.parse(String(session?.[1]?.body))).toEqual({ code: 'open-sesame' });
    expect(JSON.parse(localStorage.getItem(aiSessionKey(aiRoot(BASE_URL))) ?? 'null')).toEqual({
      token: 'ai-token',
      het: expiresAt,
    });

    // The form gives way, and the comparison can run.
    await waitFor(() =>
      expect(within(dialog).queryByLabelText(/mã truy cập ai|ai access code/i)).not.toBeInTheDocument()
    );
    expect(runButton(dialog)).toBeEnabled();
  });

  it('brings the code form back when a request is refused for want of a code', async () => {
    const gateway = stubGateway({
      chat: () =>
        json(
          {
            status_code: 403,
            message: 'Cần mã truy cập AI — nhập mã để dùng tính năng này',
            data: { code: 'ai_code_required' },
          },
          403
        ),
      status: NEEDS_CODE,
    });
    const user = userEvent.setup();
    render(<Harness status={ALLOWED} />);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByLabelText(/mã truy cập ai|ai access code/i)).not.toBeInTheDocument();

    await user.click(runButton(dialog));
    await waitFor(() => expect(gateway.chatBodies()).toHaveLength(2));
    await gateway.release();

    // Both columns report the refusal…
    await waitFor(() =>
      expect(within(dialog).getAllByText('Cần mã truy cập AI — nhập mã để dùng tính năng này')).toHaveLength(2)
    );
    // …and the code form is back, with Compare held until it is unlocked.
    expect(within(dialog).getByLabelText(/mã truy cập ai|ai access code/i)).toBeInTheDocument();
    expect(runButton(dialog)).toBeDisabled();
  });
});
