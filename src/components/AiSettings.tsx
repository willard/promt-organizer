import { useState } from 'react';
import type { AiStatus } from '../lib/storage';

interface Props {
  status: AiStatus | null;
  onStatus: (s: AiStatus) => void;
  onClose: () => void;
}

export function AiSettings({ status, onStatus, onClose }: Props) {
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const desktop = !!window.api;

  const save = async () => {
    if (!window.api || !key.trim()) return;
    setBusy(true);
    try {
      onStatus(await window.api.aiSetKey(key));
      setKey('');
      onClose();
    } finally {
      setBusy(false);
    }
  };

  const clear = async () => {
    if (!window.api) return;
    onStatus(await window.api.aiClearKey());
  };

  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="ai-settings-title">
        <h2 id="ai-settings-title">AI settings</h2>
        {!desktop ? (
          <p>AI review needs the desktop app (run <code>npm run dev</code>), because the API key is kept out of the browser.</p>
        ) : (
          <>
            <p className="help">
              AI review uses Claude through the Anthropic API. Get a key at console.anthropic.com. The key stays on this
              computer, is encrypted with your system keychain, and is only used by the app's main process.
            </p>
            <p className="small">
              Status:{' '}
              {status?.source === 'saved'
                ? 'Using saved key.'
                : status?.source === 'env'
                  ? 'Using ANTHROPIC_API_KEY from the environment.'
                  : 'No key configured.'}
            </p>
            {status && !status.encrypted && (
              <p className="error-text small">
                No system keychain is available, so a saved key is stored unencrypted (readable only by your user
                account). Setting ANTHROPIC_API_KEY in your environment instead avoids writing it to disk.
              </p>
            )}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save();
              }}
            >
              <label htmlFor="ai-key" className="label">
                Anthropic API key
              </label>
              <input
                id="ai-key"
                type="password"
                autoComplete="off"
                placeholder="sk-ant-…"
                value={key}
                onChange={(e) => setKey(e.target.value)}
                autoFocus
              />
              <div className="modal-actions">
                {status?.source === 'saved' && (
                  <button type="button" className="ghost-btn" onClick={clear}>
                    Remove saved key
                  </button>
                )}
                <button type="button" className="secondary-btn" onClick={onClose}>
                  Cancel
                </button>
                <button type="submit" className="primary-btn" disabled={busy || !key.trim()}>
                  Save key
                </button>
              </div>
            </form>
          </>
        )}
        {!desktop && (
          <div className="modal-actions">
            <button type="button" className="secondary-btn" onClick={onClose}>
              Close
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
