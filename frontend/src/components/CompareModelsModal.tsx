import React, { useEffect, useId, useRef, useState } from 'react';
import { Alert, Button, Input, Modal, Select, Spin, Typography } from 'antd';
import { useTranslation } from 'react-i18next';
import {
  AI_PROMPT_MAX_CHARS,
  AiError,
  aiService,
  type AiChatAnswer,
  type AiStatus,
} from '../services/aiService';
import { EModel } from '../types';
import { MarkdownRenderer } from './MarkdownRenderer';
import { AiAccessCodeForm } from './AiAccessCodeForm';

const { TextArea } = Input;

/** One side of the comparison. The model is recorded per run, so changing a picker does not relabel an answer. */
type ColumnState =
  | { phase: 'idle' }
  | { phase: 'loading'; model: string }
  | { phase: 'done'; model: string; answer: AiChatAnswer }
  | { phase: 'error'; model: string; message: string };

type Pair<T> = [T, T];

const IDLE: ColumnState = { phase: 'idle' };
const DEFAULT_MODELS: Pair<EModel> = [EModel.GEMINI_2_5_FLASH, EModel.GEMINI_2_5_PRO];

interface CompareModelsModalProps {
  open: boolean;
  onClose: () => void;
  /** The message box's text, used to prefill the prompt whenever the modal opens. */
  initialPrompt: string;
  /** The gateway's last answer, from the chat. */
  status: AiStatus | null;
  /** The gateway's status changed here: an access code was accepted, or asked for. */
  onStatusChange: (status: AiStatus | null) => void;
}

const CompareColumn: React.FC<{ model: string; state: ColumnState }> = ({ model, state }) => {
  const { t } = useTranslation();
  const headingId = useId();
  const shownModel = state.phase === 'idle' ? model : state.model;

  return (
    <section className="compare-column" aria-labelledby={headingId} aria-busy={state.phase === 'loading'}>
      <div className="compare-column-head">
        <span id={headingId} className="compare-column-title">
          {t(`models.${shownModel}`, { defaultValue: shownModel })}
        </span>
      </div>

      <div className="compare-column-body">
        {state.phase === 'idle' && <div className="compare-placeholder">{t('compare.idle')}</div>}
        {state.phase === 'loading' && (
          <div className="compare-placeholder" role="status">
            <Spin size="small" /> <span>{t('compare.waiting')}</span>
          </div>
        )}
        {state.phase === 'error' && <Alert type="error" showIcon message={state.message} />}
        {state.phase === 'done' && <MarkdownRenderer content={state.answer.text} />}
      </div>

      {state.phase === 'done' && (
        <div className="compare-column-meta">
          {t('compare.meta', { ms: state.answer.ms, count: state.answer.outputTokens })}
          {state.answer.finishReason && state.answer.finishReason !== 'STOP'
            ? ` · ${state.answer.finishReason}`
            : ''}
        </div>
      )}
    </section>
  );
};

/**
 * The same prompt sent to two models side by side, through the AI gateway.
 *
 * Stateless on the server: nothing is filed in the conversation. Each run is
 * two requests and counts twice against the gateway's limits, so the button
 * stays disabled until the two models differ. State is kept while the chat is
 * open, so closing the modal by accident does not throw the answers away.
 */
export const CompareModelsModal: React.FC<CompareModelsModalProps> = ({
  open,
  onClose,
  initialPrompt,
  status,
  onStatusChange,
}) => {
  const { t } = useTranslation();
  const promptId = useId();
  const [prompt, setPrompt] = useState(() => initialPrompt.slice(0, AI_PROMPT_MAX_CHARS));
  const [models, setModels] = useState<Pair<EModel>>(DEFAULT_MODELS);
  const [columns, setColumns] = useState<Pair<ColumnState>>([IDLE, IDLE]);
  /** Set when a request was refused for want of a code, before the status catches up. */
  const [codeRequired, setCodeRequired] = useState(false);
  const [wasOpen, setWasOpen] = useState(open);
  const controllerRef = useRef<AbortController | null>(null);

  // Prefill from the message box each time the modal opens. Adjusted during
  // render rather than in an effect, so the first frame already shows it.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open && initialPrompt.trim()) setPrompt(initialPrompt.slice(0, AI_PROMPT_MAX_CHARS));
  }

  // Leaving the chat abandons whatever is still in flight.
  useEffect(() => () => controllerRef.current?.abort(), []);

  const needsCode =
    codeRequired || Boolean(status?.enabled && !status.allowed && status.needs === 'code');
  const loading = columns.some((column) => column.phase === 'loading');
  const sameModel = models[0] === models[1];
  const canCompare = Boolean(prompt.trim()) && !sameModel && !needsCode && !loading;

  const setColumn = (index: number, state: ColumnState) =>
    setColumns((current) => {
      const next: Pair<ColumnState> = [current[0], current[1]];
      next[index] = state;
      return next;
    });

  const handleCompare = () => {
    const text = prompt.trim();
    if (!canCompare) return;

    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    const pair: Pair<EModel> = [models[0], models[1]];
    setColumns([
      { phase: 'loading', model: pair[0] },
      { phase: 'loading', model: pair[1] },
    ]);

    let askedForCode = false;

    // Both at once: the point is to see them side by side, and each column
    // fills in (or fails) on its own.
    pair.forEach((model, index) => {
      aiService.chat({ prompt: text, model }, controller.signal).then(
        (answer) => {
          if (!controller.signal.aborted) setColumn(index, { phase: 'done', model, answer });
        },
        (error: unknown) => {
          if (controller.signal.aborted) return;
          if (error instanceof AiError && error.code === 'ai_code_required' && !askedForCode) {
            // The token expired, or was never valid: show the code form now,
            // and let the chat's copy of the status catch up.
            askedForCode = true;
            setCodeRequired(true);
            aiService.getStatus(true).then(onStatusChange, () => undefined);
          }
          const message = error instanceof Error && error.message ? error.message : t('ai.errors.network');
          setColumn(index, { phase: 'error', model, message });
        }
      );
    });
  };

  const handleUnlocked = (next: AiStatus) => {
    setCodeRequired(false);
    onStatusChange(next);
  };

  const modelOptions = Object.values(EModel).map((model) => ({
    label: t(`models.${model}`),
    value: model,
  }));

  return (
    <Modal
      open={open}
      onCancel={onClose}
      title={t('compare.title')}
      footer={null}
      width={1100}
      className="compare-modal"
    >
      <div className="compare-modal-body">
        {needsCode && <AiAccessCodeForm onUnlocked={handleUnlocked} />}

        <label htmlFor={promptId} className="compare-label">
          {t('compare.promptLabel')}
        </label>
        <TextArea
          id={promptId}
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          onKeyDown={(e) => {
            // Ctrl/Cmd + Enter runs it, like most prompt boxes.
            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
              e.preventDefault();
              handleCompare();
            }
          }}
          placeholder={t('compare.promptPlaceholder')}
          autoSize={{ minRows: 3, maxRows: 10 }}
          maxLength={AI_PROMPT_MAX_CHARS}
          showCount
        />

        <div className="compare-controls">
          <Select
            value={models[0]}
            onChange={(value: EModel) => setModels(([, second]) => [value, second])}
            options={modelOptions}
            aria-label={t('compare.modelA')}
            className="compare-model-select"
          />
          <span className="compare-versus" aria-hidden="true">
            {t('compare.versus')}
          </span>
          <Select
            value={models[1]}
            onChange={(value: EModel) => setModels(([first]) => [first, value])}
            options={modelOptions}
            aria-label={t('compare.modelB')}
            className="compare-model-select"
          />
          <Button type="primary" onClick={handleCompare} disabled={!canCompare} loading={loading}>
            {t('compare.run')}
          </Button>
        </div>

        {sameModel && (
          <Typography.Text type="warning" className="compare-hint">
            {t('compare.sameModel')}
          </Typography.Text>
        )}
        <Typography.Paragraph type="secondary" className="compare-note">
          {t('compare.note')}
        </Typography.Paragraph>

        <div className="compare-columns">
          <CompareColumn model={models[0]} state={columns[0]} />
          <CompareColumn model={models[1]} state={columns[1]} />
        </div>
      </div>
    </Modal>
  );
};
