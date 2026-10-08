import { useRef, useState } from 'react';
import {
  KIND_LABEL,
  KIND_STEP,
  applySuggestion,
  canApply,
  requestReview,
  type Review,
  type Suggestion,
} from '../lib/ai';
import type { Spec } from '../lib/spec';
import type { Update } from './steps';

interface Props {
  spec: Spec;
  update: Update;
  review: Review | null;
  setReview: (r: Review | null) => void;
  aiAvailable: boolean;
  onOpenSettings: () => void;
  onJump: (step: string) => void;
  notify: (msg: string) => void;
}

export function AiReview({ spec, update, review, setReview, aiAvailable, onOpenSettings, onJump, notify }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const panel = useRef<HTMLElement>(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await requestReview(spec);
      if (res.ok) setReview(res.review);
      else setError(res.error);
      requestAnimationFrame(() => panel.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const remove = (ids: string[]) =>
    review && setReview({ ...review, suggestions: review.suggestions.filter((s) => !ids.includes(s.id)) });

  const edit = (id: string, text: string) =>
    review && setReview({ ...review, suggestions: review.suggestions.map((s) => (s.id === id ? { ...s, text } : s)) });

  const apply = (items: Suggestion[]) => {
    const applicable = items.filter((s) => s.text.trim() && canApply(spec, s));
    if (!applicable.length) return;
    update((d) => applicable.forEach((s) => applySuggestion(d, s)));
    remove(applicable.map((s) => s.id));
    notify(applicable.length === 1 ? 'Added to spec' : `Added ${applicable.length} suggestions to spec`);
  };

  const pending = review?.suggestions ?? [];
  const applicableCount = pending.filter((s) => canApply(spec, s)).length;

  return (
    <section className="ai-review" aria-label="AI review" ref={panel}>
      <header className="ai-head">
        <div>
          <h2>Improve with AI</h2>
          <p className="help">
            Claude reads the spec, finds gaps and contradictions, and proposes additions. Nothing changes until you
            apply a suggestion.
          </p>
        </div>
        {aiAvailable ? (
          <button type="button" className="primary-btn" onClick={run} disabled={loading}>
            {loading ? 'Reviewing…' : review ? 'Review again' : 'Review my spec'}
          </button>
        ) : (
          <button type="button" className="secondary-btn" onClick={onOpenSettings}>
            Set up AI
          </button>
        )}
      </header>

      {loading && (
        <p className="muted" role="status">
          <span className="spinner" aria-hidden /> Claude is reading your spec. This usually takes under a minute.
        </p>
      )}
      {error && (
        <p className="error-text" role="alert">
          {error}
        </p>
      )}

      {review && !loading && (
        <>
          {review.summary && <p className="ai-summary">{review.summary}</p>}
          {pending.length === 0 ? (
            <p className="ok-text">All suggestions handled.</p>
          ) : (
            <>
              <div className="ai-bulk">
                <span className="muted small">{pending.length} suggestions</span>
                <button type="button" className="secondary-btn" disabled={!applicableCount} onClick={() => apply(pending)}>
                  Apply all ({applicableCount})
                </button>
                <button type="button" className="ghost-btn" onClick={() => setReview({ ...review, suggestions: [] })}>
                  Dismiss all
                </button>
              </div>
              <ul className="suggestions">
                {pending.map((s) => {
                  const ok = canApply(spec, s);
                  return (
                    <li key={s.id} className={`suggestion ${s.kind === 'issue' ? 'is-issue' : ''}`}>
                      <div className="sug-meta">
                        <button type="button" className="sug-kind" onClick={() => onJump(KIND_STEP[s.kind])} title="Go to this step">
                          {KIND_LABEL[s.kind]}
                          {s.target && <> · {s.target}</>}
                        </button>
                      </div>
                      <textarea
                        aria-label="Suggestion text"
                        rows={Math.min(4, Math.ceil(s.text.length / 70) || 1)}
                        value={s.text}
                        onChange={(e) => edit(s.id, e.target.value)}
                      />
                      {s.reason && <p className="help">{s.reason}</p>}
                      {!ok && <p className="error-text small">Feature "{s.target}" no longer exists.</p>}
                      <div className="sug-actions">
                        <button type="button" className="secondary-btn" disabled={!ok || !s.text.trim()} onClick={() => apply([s])}>
                          {s.kind === 'issue' ? 'Add as open question' : 'Apply'}
                        </button>
                        <button type="button" className="ghost-btn" onClick={() => remove([s.id])}>
                          Dismiss
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </>
      )}
    </section>
  );
}
