import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AiReview } from './components/AiReview';
import { SettingsDialog } from './components/SettingsDialog';
import { STEPS, type Update } from './components/steps';
import type { Review } from './lib/ai';
import { generateMarkdown } from './lib/markdown';
import { completeness, lintSpec, type Issue } from './lib/lint';
import { emptySpec, fileNameFor, type Spec } from './lib/spec';
import { loadAiEnabled, saveAiEnabled } from './lib/prefs';
import { deleteSpec, exportFile, importDraft, listSpecs, saveSpec, type AiStatus } from './lib/storage';

const slug = (s: string) => s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'spec';

export default function App() {
  const [drafts, setDrafts] = useState<Spec[]>([]);
  const [spec, setSpec] = useState<Spec>(emptySpec);
  const [stepIndex, setStepIndex] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(true);
  const [review, setReview] = useState<Review | null>(null);
  const [aiStatus, setAiStatus] = useState<AiStatus | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [aiEnabled, setAiEnabled] = useState(loadAiEnabled);
  const dirty = useRef(false);

  useEffect(() => {
    window.api?.aiStatus().then(setAiStatus);
  }, []);

  useEffect(() => {
    listSpecs().then((list) => {
      setDrafts(list);
      if (list[0]) setSpec(list[0]);
    });
  }, []);

  // Debounced autosave of the current draft.
  useEffect(() => {
    if (!dirty.current) return;
    const t = setTimeout(() => {
      dirty.current = false;
      saveSpec(spec).catch(() => notify('Could not save draft'));
      setDrafts((list) => [spec, ...list.filter((s) => s.id !== spec.id)]);
    }, 400);
    return () => clearTimeout(t);
  }, [spec]);

  const notify = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast((cur) => (cur === msg ? null : cur)), 2500);
  };

  const update: Update = useCallback((fn) => {
    setSpec((prev) => {
      const next = structuredClone(prev);
      fn(next);
      next.updatedAt = new Date().toISOString();
      dirty.current = true;
      return next;
    });
  }, []);

  const markdown = useMemo(() => generateMarkdown(spec), [spec]);
  const issues = useMemo(() => lintSpec(spec), [spec]);
  const score = useMemo(() => completeness(spec), [spec]);
  const step = STEPS[stepIndex];

  // Persist pending edits immediately before switching away from the current draft.
  const flush = () => {
    if (!dirty.current) return;
    dirty.current = false;
    saveSpec(spec).catch(() => notify('Could not save draft'));
    setDrafts((list) => [spec, ...list.filter((s) => s.id !== spec.id)]);
  };

  const openDraft = (s: Spec) => {
    flush();
    setReview(null);
    setSpec(s);
    setStepIndex(0);
  };

  const newDraft = () => {
    flush();
    setReview(null);
    setSpec(emptySpec());
    setStepIndex(0);
  };

  const removeDraft = async (s: Spec) => {
    if (!confirm(`Delete "${s.overview.name || 'Untitled'}"? This cannot be undone.`)) return;
    await deleteSpec(s.id);
    const rest = drafts.filter((d) => d.id !== s.id);
    setDrafts(rest);
    if (s.id === spec.id) {
      dirty.current = false;
      rest[0] ? openDraft(rest[0]) : newDraft();
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      notify('Markdown copied — paste it into your AI agent');
    } catch {
      notify('Copy failed');
    }
  };

  const exportMd = async () => {
    const saved = await exportFile(fileNameFor(spec), markdown, 'md');
    if (saved) notify(`Saved ${saved}`);
  };

  const exportJson = async () => {
    const saved = await exportFile(`${slug(spec.overview.name)}.spec.json`, JSON.stringify(spec, null, 2), 'json');
    if (saved) notify(`Saved ${saved}`);
  };

  const importJson = async () => {
    try {
      const s = await importDraft();
      if (!s) return;
      flush();
      setReview(null);
      dirty.current = true;
      setSpec({ ...s, updatedAt: new Date().toISOString() });
      setStepIndex(0);
      notify('Draft imported');
    } catch {
      notify('That file is not a valid spec draft');
    }
  };

  const issuesByStep = useMemo(() => {
    const m = new Map<string, Issue[]>();
    issues.forEach((i) => m.set(i.step, [...(m.get(i.step) ?? []), i]));
    return m;
  }, [issues]);

  const goTo = (id: string) => setStepIndex(Math.max(0, STEPS.findIndex((s) => s.id === id)));

  return (
    <div className={`app ${showPreview ? '' : 'no-preview'}`}>
      <aside className="sidebar">
        <div className="brand">
          <span className="logo" aria-hidden>
            ⌘
          </span>
          Prompt Organizer
        </div>
        <div className="sidebar-actions">
          <button type="button" className="primary-btn" onClick={newDraft}>
            + New spec
          </button>
          <button type="button" className="secondary-btn" onClick={importJson} title="Import a .spec.json draft">
            Import
          </button>
        </div>

        <nav aria-label="Wizard steps" className="steps">
          {STEPS.map((s, i) => {
            const count = issuesByStep.get(s.id)?.filter((x) => x.severity !== 'tip').length ?? 0;
            return (
              <button
                type="button"
                key={s.id}
                className={`step-link ${i === stepIndex ? 'active' : ''}`}
                aria-current={i === stepIndex ? 'step' : undefined}
                onClick={() => setStepIndex(i)}
              >
                <span className="step-num">{i + 1}</span>
                <span className="step-title">{s.title}</span>
                {count > 0 && <span className="badge" title={`${count} to fix`}>{count}</span>}
              </button>
            );
          })}
        </nav>

        <div className="drafts">
          <h3>Saved specs</h3>
          {drafts.length === 0 && <p className="muted small">Drafts save automatically as you type.</p>}
          {drafts.map((d) => (
            <div key={d.id} className={`draft ${d.id === spec.id ? 'active' : ''}`}>
              <button type="button" className="draft-open" onClick={() => openDraft(d)}>
                <span className="draft-name">{d.overview.name || 'Untitled'}</span>
                <span className="muted small">{new Date(d.updatedAt).toLocaleString()}</span>
              </button>
              <button type="button" className="icon-btn" aria-label={`Delete ${d.overview.name || 'Untitled'}`} onClick={() => removeDraft(d)}>
                ×
              </button>
            </div>
          ))}
        </div>
        <button type="button" className="ai-settings-btn" onClick={() => setShowSettings(true)}>
          {aiEnabled && <span className={`dot ${aiStatus?.configured ? 'on' : ''}`} title="AI key configured" />}
          Settings
        </button>
      </aside>

      <main className="wizard">
        <header className="wizard-head">
          <div className="muted small">
            Step {stepIndex + 1} of {STEPS.length} · {step.title}
          </div>
          <h1>{step.question}</h1>
          <div className="progress" aria-hidden>
            <div style={{ width: `${((stepIndex + 1) / STEPS.length) * 100}%` }} />
          </div>
        </header>

        <div className="wizard-body">
          {step.render({ spec, update })}
          {step.id === 'review' && (
            <>
              {aiEnabled && (
                <AiReview
                  spec={spec}
                  update={update}
                  review={review}
                  setReview={setReview}
                  aiAvailable={!!aiStatus?.configured}
                  onOpenSettings={() => setShowSettings(true)}
                  onJump={goTo}
                  notify={notify}
                />
              )}
              <IssueList issues={issues} score={score} onJump={goTo} />
            </>
          )}
          {step.id !== 'review' && (issuesByStep.get(step.id)?.length ?? 0) > 0 && (
            <IssueList issues={issuesByStep.get(step.id)!} compact />
          )}
        </div>

        <footer className="wizard-foot">
          <button type="button" className="secondary-btn" disabled={stepIndex === 0} onClick={() => setStepIndex((i) => i - 1)}>
            ← Back
          </button>
          <button type="button" className="ghost-btn" onClick={() => setShowPreview((v) => !v)}>
            {showPreview ? 'Hide preview' : 'Show preview'}
          </button>
          {stepIndex < STEPS.length - 1 ? (
            <button type="button" className="primary-btn" onClick={() => setStepIndex((i) => i + 1)}>
              Next →
            </button>
          ) : (
            <button type="button" className="primary-btn" onClick={exportMd}>
              Export {fileNameFor(spec)}
            </button>
          )}
        </footer>
      </main>

      {showPreview && (
        <section className="preview" aria-label="Markdown preview">
          <header className="preview-head">
            <div>
              <div className="preview-title">{fileNameFor(spec)}</div>
              <div className="meter" title="How much the agent will not have to guess">
                <div className="meter-bar">
                  <div style={{ width: `${score}%` }} className={score >= 75 ? 'good' : score >= 40 ? 'ok' : 'low'} />
                </div>
                <span className="small muted">{score}% complete</span>
              </div>
            </div>
            <div className="preview-actions">
              <button type="button" className="secondary-btn" onClick={copy}>
                Copy
              </button>
              <button type="button" className="secondary-btn" onClick={exportJson} title="Save the draft as JSON to share or back up">
                Save draft
              </button>
              <button type="button" className="primary-btn" onClick={exportMd}>
                Export .md
              </button>
            </div>
          </header>
          <pre className="preview-body">{markdown}</pre>
        </section>
      )}

      {showSettings && (
        <SettingsDialog
          status={aiStatus}
          onStatus={setAiStatus}
          aiEnabled={aiEnabled}
          onAiEnabled={(on) => {
            setAiEnabled(on);
            saveAiEnabled(on);
          }}
          onClose={() => setShowSettings(false)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}

interface IssueListProps {
  issues: Issue[];
  score?: number;
  compact?: boolean;
  onJump?: (step: string) => void;
}

function IssueList({ issues, score, compact, onJump }: IssueListProps) {
  const icon = { error: '●', warning: '▲', tip: '◆' } as const;
  return (
    <div className={`issues ${compact ? 'compact' : ''}`}>
      {!compact && (
        <h2>
          Spec check {score !== undefined && <span className="muted">· {score}% complete</span>}
        </h2>
      )}
      {!compact && issues.length === 0 && <p className="ok-text">Looks solid. Export it and hand it to your agent.</p>}
      <ul>
        {issues.map((i, n) => (
          <li key={n} className={i.severity}>
            <span className="sev" aria-label={i.severity}>
              {icon[i.severity]}
            </span>
            <span>{i.message}</span>
            {onJump && (
              <button type="button" className="link-btn" onClick={() => onJump(i.step)}>
                Fix
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
