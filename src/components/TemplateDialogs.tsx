import { useState } from 'react';
import { PROJECT_TYPES, type Spec } from '../lib/spec';
import {
  ALL_SECTIONS,
  BUILT_IN_TEMPLATES,
  DEFAULT_SECTIONS,
  SECTION_LABEL,
  createTemplate,
  type Template,
  type TemplateSection,
} from '../lib/templates';

function Modal({ title, wide, onClose, children }: { title: string; wide?: boolean; onClose: () => void; children: React.ReactNode }) {
  return (
    <div
      className="modal-backdrop"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
      onKeyDown={(e) => e.key === 'Escape' && onClose()}
    >
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        {children}
      </div>
    </div>
  );
}

const typeLabel = (t: Template) => PROJECT_TYPES.find((p) => p.value === t.spec.overview.projectType)?.label;

interface PickerProps {
  templates: Template[];
  onPick: (t: Template | null) => void;
  onDelete: (t: Template) => void;
  onClose: () => void;
}

/** Shown on "New spec": blank, built-in starters, or the user's own templates. */
export function TemplatePicker({ templates, onPick, onDelete, onClose }: PickerProps) {
  const card = (t: Template) => (
    <div key={t.id} className="tpl-card">
      <button type="button" className="tpl-open" onClick={() => onPick(t)}>
        <span className="tpl-name">{t.name}</span>
        {t.description && <span className="tpl-desc">{t.description}</span>}
        <span className="tpl-tags">
          {/* Starters all carry the same sections, so only the project type tells them apart. */}
          {[typeLabel(t), ...(t.builtIn ? [] : t.sections.map((s) => SECTION_LABEL[s]))].filter(Boolean).join(' · ')}
        </span>
      </button>
      {!t.builtIn && (
        <button type="button" className="icon-btn" aria-label={`Delete template ${t.name}`} onClick={() => onDelete(t)}>
          ×
        </button>
      )}
    </div>
  );

  return (
    <Modal title="New spec" wide onClose={onClose}>
      <div className="tpl-grid">
        <div className="tpl-card blank">
          <button type="button" className="tpl-open" onClick={() => onPick(null)} autoFocus>
            <span className="tpl-name">Blank spec</span>
            <span className="tpl-desc">Start from scratch and answer every question yourself.</span>
          </button>
        </div>
      </div>
      {templates.length > 0 && (
        <>
          <h3 className="tpl-heading">My templates</h3>
          <div className="tpl-grid">{templates.map(card)}</div>
        </>
      )}
      <h3 className="tpl-heading">Starters</h3>
      <p className="help">Prefill the stack, commands, agent rules and definition of done. Edit anything afterwards.</p>
      <div className="tpl-grid">{BUILT_IN_TEMPLATES.map(card)}</div>
      <div className="modal-actions">
        <button type="button" className="secondary-btn" onClick={onClose}>
          Cancel
        </button>
      </div>
    </Modal>
  );
}

interface SaveProps {
  spec: Spec;
  onSave: (t: Template) => void;
  onClose: () => void;
}

export function SaveTemplateDialog({ spec, onSave, onClose }: SaveProps) {
  const [name, setName] = useState(spec.overview.name ? `${spec.overview.name} setup` : '');
  const [description, setDescription] = useState('');
  const [sections, setSections] = useState<TemplateSection[]>(DEFAULT_SECTIONS);

  const toggle = (s: TemplateSection, on: boolean) =>
    setSections((cur) => (on ? [...cur, s] : cur.filter((x) => x !== s)));

  return (
    <Modal title="Save as template" onClose={onClose}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && sections.length) onSave(createTemplate(spec, name, description, sections));
        }}
      >
        <label htmlFor="tpl-name" className="label">
          Template name
        </label>
        <input id="tpl-name" type="text" value={name} placeholder="e.g. My Next.js + Supabase stack" onChange={(e) => setName(e.target.value)} autoFocus />
        <label htmlFor="tpl-desc" className="label">
          Description <span className="muted">(optional)</span>
        </label>
        <input id="tpl-desc" type="text" value={description} onChange={(e) => setDescription(e.target.value)} />
        <fieldset className="tpl-sections">
          <legend className="label">Include</legend>
          <p className="help">Project type and output format are always included. The name, pitch, summary and open questions never are.</p>
          {ALL_SECTIONS.map((s) => (
            <label key={s} className="checkbox">
              <input type="checkbox" checked={sections.includes(s)} onChange={(e) => toggle(s, e.target.checked)} />
              {SECTION_LABEL[s]}
            </label>
          ))}
        </fieldset>
        <div className="modal-actions">
          <button type="button" className="secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="primary-btn" disabled={!name.trim() || !sections.length}>
            Save template
          </button>
        </div>
      </form>
    </Modal>
  );
}
