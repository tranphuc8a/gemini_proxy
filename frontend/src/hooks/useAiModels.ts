import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { aiService, type AiModels } from '../services/aiService';
import { DEFAULT_MODEL, FALLBACK_MODELS } from '../types';

export interface ModelOption {
  value: string;
  label: string;
  disabled?: boolean;
}

/**
 * The Gemini models this visitor may pick, from the server (GET /ai/models, asked
 * once and shared), newest first. Until the answer arrives — or when the server
 * cannot list them — a built-in list stands in so the picker is never empty.
 * Models this visitor may not use (Pro, for administrators) are shown disabled.
 */
export const useAiModels = () => {
  const { t } = useTranslation();
  const [catalog, setCatalog] = useState<AiModels | null>(null);

  useEffect(() => {
    let active = true;
    aiService.listModels().then(
      (next) => {
        if (active) setCatalog(next);
      },
      () => {
        if (active) setCatalog(null);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  const options = useMemo<ModelOption[]>(() => {
    if (!catalog || !catalog.models.length) {
      return FALLBACK_MODELS.map((m) => ({ value: m.id, label: m.label }));
    }
    return catalog.models.map((m) => ({
      value: m.id,
      label:
        (m.label || m.id) +
        (m.preview ? ` · ${t('models.preview')}` : '') +
        (!m.allowed ? ` — ${t('models.adminOnly')}` : ''),
      disabled: !m.allowed,
    }));
  }, [catalog, t]);

  return { options, defaultModel: catalog?.default || DEFAULT_MODEL, loaded: catalog !== null };
};
