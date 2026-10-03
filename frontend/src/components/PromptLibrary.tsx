import React, { useId, useMemo, useRef, useState } from 'react';
import { Button, Drawer, Empty, Grid, Input, Tooltip, Typography } from 'antd';
import { BookOutlined, DeleteOutlined, SaveOutlined, SearchOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { usePromptStore } from '../store/promptStore';
import { PROMPT_GROUPS, PROMPT_TEMPLATES, matchesPromptQuery } from '../utils/promptLibrary';
import { showToast } from '../utils/toast';

const { useBreakpoint } = Grid;

interface PromptLibraryProps {
  /** What the message box holds now: what "save as prompt" keeps. */
  currentInput: string;
  /** Put a prompt into the message box. */
  onInsert: (text: string) => void;
  /**
   * The drawer finished closing after an insertion. The drawer hands focus back
   * to the button that opened it as it closes; this is the moment to move it on
   * to the message box instead.
   */
  onClosedAfterInsert?: () => void;
}

interface PromptItemProps {
  title: string;
  text: string;
  onChoose: (text: string) => void;
  onDelete?: () => void;
  deleteLabel?: string;
}

/** One prompt: named by its title, described by its text. */
const PromptItem: React.FC<PromptItemProps> = ({ title, text, onChoose, onDelete, deleteLabel }) => {
  const id = useId();
  return (
    <li className="prompt-item">
      <button
        type="button"
        className="prompt-item-main"
        onClick={() => onChoose(text)}
        aria-labelledby={`${id}-title`}
        aria-describedby={`${id}-text`}
      >
        <span id={`${id}-title`} className="prompt-item-title">
          {title}
        </span>
        <span id={`${id}-text`} className="prompt-item-text">
          {text}
        </span>
      </button>
      {onDelete && (
        <Button
          type="text"
          size="small"
          danger
          icon={<DeleteOutlined />}
          onClick={onDelete}
          aria-label={deleteLabel}
          title={deleteLabel}
          className="prompt-item-delete"
        />
      )}
    </li>
  );
};

const PromptSection: React.FC<{ title: string; action?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  action,
  children,
}) => {
  const headingId = useId();
  return (
    <section className="prompt-section" aria-labelledby={headingId}>
      <div className="prompt-section-head">
        <Typography.Title level={5} id={headingId} className="prompt-section-title">
          {title}
        </Typography.Title>
        {action}
      </div>
      {children}
    </section>
  );
};

/**
 * The prompt library beside the message box: built-in templates by group, plus
 * the visitor's own prompts kept in this browser.
 *
 * Choosing one puts it in the message box (replacing nothing: it is appended on
 * a new line when the box already has text) and never sends it.
 */
export const PromptLibrary: React.FC<PromptLibraryProps> = ({ currentInput, onInsert, onClosedAfterInsert }) => {
  const { t } = useTranslation();
  const screens = useBreakpoint();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const insertedRef = useRef(false);
  const { prompts, addPrompt, removePrompt, reload } = usePromptStore();

  const templates = useMemo(
    () =>
      PROMPT_TEMPLATES.map((template) => ({
        ...template,
        title: t(`prompts.templates.${template.id}.title`),
        text: t(`prompts.templates.${template.id}.text`),
      })),
    [t]
  );

  const searching = Boolean(query.trim());
  const mine = prompts.filter((prompt) => matchesPromptQuery(prompt, query));
  const groups = PROMPT_GROUPS.map((group) => ({
    group,
    items: templates.filter((template) => template.group === group && matchesPromptQuery(template, query)),
  })).filter(({ items }) => items.length > 0);

  const handleOpen = () => {
    // Another tab may have changed the list since this one last read it.
    reload();
    setOpen(true);
  };

  const handleChoose = (text: string) => {
    insertedRef.current = true;
    onInsert(text);
    setOpen(false);
  };

  const handleSave = () => {
    const result = addPrompt(currentInput);
    if (result === 'added') showToast.success(t('prompts.saved'));
    else if (result === 'duplicate') showToast.info(t('prompts.alreadySaved'));
    else if (result === 'unsaved') showToast.warning(t('prompts.saveFailed'));
  };

  return (
    <>
      <Tooltip title={t('prompts.open')}>
        <Button
          size="large"
          icon={<BookOutlined />}
          onClick={handleOpen}
          aria-label={t('prompts.open')}
          aria-haspopup="dialog"
          aria-expanded={open}
          className="chat-library-btn"
        />
      </Tooltip>

      <Drawer
        title={t('prompts.title')}
        placement="right"
        open={open}
        onClose={() => setOpen(false)}
        width={screens.sm ? 440 : '100%'}
        className="prompt-library"
        afterOpenChange={(visible) => {
          if (visible || !insertedRef.current) return;
          insertedRef.current = false;
          // After the drawer's own focus restore, which runs right after this.
          window.setTimeout(() => onClosedAfterInsert?.(), 0);
        }}
      >
        <Input
          allowClear
          prefix={<SearchOutlined />}
          placeholder={t('prompts.search')}
          aria-label={t('prompts.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="prompt-search"
        />
        <div className="prompt-library-hint">{t('prompts.insertHint')}</div>

        <PromptSection
          title={t('prompts.mine')}
          action={
            <Button size="small" icon={<SaveOutlined />} onClick={handleSave} disabled={!currentInput.trim()}>
              {t('prompts.saveCurrent')}
            </Button>
          }
        >
          {mine.length > 0 ? (
            <ul className="prompt-list">
              {mine.map((prompt) => (
                <PromptItem
                  key={prompt.id}
                  title={prompt.title}
                  text={prompt.text}
                  onChoose={handleChoose}
                  onDelete={() => removePrompt(prompt.id)}
                  deleteLabel={t('prompts.delete', { title: prompt.title })}
                />
              ))}
            </ul>
          ) : (
            !searching && <div className="prompt-empty">{t('prompts.emptyMine')}</div>
          )}
        </PromptSection>

        {groups.map(({ group, items }) => (
          <PromptSection key={group} title={t(`prompts.groups.${group}`)}>
            <ul className="prompt-list">
              {items.map((template) => (
                <PromptItem key={template.id} title={template.title} text={template.text} onChoose={handleChoose} />
              ))}
            </ul>
          </PromptSection>
        ))}

        {searching && mine.length === 0 && groups.length === 0 && (
          <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={t('prompts.noResults')} />
        )}
      </Drawer>
    </>
  );
};
