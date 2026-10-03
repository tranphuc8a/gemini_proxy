import { useEffect, useState } from 'react';
import { aiService, type AiStatus } from '../services/aiService';

/**
 * What the AI gateway lets this visitor do.
 *
 * Asked once when the chat mounts (the client shares the answer). Null until
 * known, and also when the server cannot say: an AI feature stays hidden rather
 * than offered and then failing. `setStatus` takes a fresher answer, e.g. once
 * an access code has been accepted.
 */
export const useAiStatus = () => {
  const [status, setStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    let active = true;
    aiService.getStatus().then(
      (next) => {
        if (active) setStatus(next);
      },
      () => {
        if (active) setStatus(null);
      }
    );
    return () => {
      active = false;
    };
  }, []);

  return { status, setStatus };
};
