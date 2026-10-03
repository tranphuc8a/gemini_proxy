import React, { useId, useState } from 'react';
import { Button, Input } from 'antd';
import { LockOutlined } from '@ant-design/icons';
import { useTranslation } from 'react-i18next';
import { aiService, type AiStatus } from '../services/aiService';
import { showToast } from '../utils/toast';

interface AiAccessCodeFormProps {
  /** The code was accepted; `status` is the gateway's answer once unlocked. */
  onUnlocked: (status: AiStatus) => void;
}

/**
 * The access-code prompt shown when the AI gateway runs in "code" mode and this
 * visitor has no valid token yet.
 *
 * The token it receives is stored where every page of this origin looks for it,
 * so one unlock also covers the course pages, and vice versa.
 */
export const AiAccessCodeForm: React.FC<AiAccessCodeFormProps> = ({ onUnlocked }) => {
  const { t } = useTranslation();
  const inputId = useId();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const value = code.trim();
    if (!value || busy) return;

    setBusy(true);
    setError(null);
    try {
      const status = await aiService.unlock(value);
      setCode('');
      showToast.success(t('ai.unlocked'));
      onUnlocked(status);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : t('ai.errors.network'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="ai-code-form" onSubmit={handleSubmit}>
      <label htmlFor={inputId} className="ai-code-label">
        {t('ai.codeLabel')}
      </label>
      <div className="ai-code-row">
        <Input.Password
          id={inputId}
          value={code}
          onChange={(e) => setCode(e.target.value)}
          prefix={<LockOutlined />}
          placeholder={t('ai.codeLabel')}
          autoComplete="off"
          maxLength={200}
          status={error ? 'error' : undefined}
          aria-describedby={`${inputId}-hint`}
        />
        <Button type="primary" htmlType="submit" loading={busy} disabled={!code.trim()}>
          {t('ai.unlock')}
        </Button>
      </div>
      <div id={`${inputId}-hint`} className="ai-code-hint">
        {t('ai.codeHint')}
      </div>
      {error && (
        <div className="ai-code-error" role="alert">
          {error}
        </div>
      )}
    </form>
  );
};
