import { useId, useLayoutEffect, useRef, type ReactNode } from 'react';

interface FieldProps {
  label: string;
  help?: string;
  children: (id: string) => ReactNode;
}

export function Field({ label, help, children }: FieldProps) {
  const id = useId();
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      {help && <p className="help">{help}</p>}
      {children(id)}
    </div>
  );
}

interface TextProps {
  label: string;
  help?: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  multiline?: boolean;
  rows?: number;
  mono?: boolean;
  suggestions?: string[];
}

export function Text({ label, help, value, onChange, placeholder, multiline, rows = 4, mono, suggestions }: TextProps) {
  const addSuggestion = (s: string) => {
    const parts = value.split(',').map((p) => p.trim()).filter(Boolean);
    if (parts.includes(s)) return;
    onChange([...parts, s].join(', '));
  };
  return (
    <Field label={label} help={help}>
      {(id) => (
        <>
          {multiline ? (
            <textarea
              id={id}
              className={mono ? 'mono' : undefined}
              rows={rows}
              value={value}
              placeholder={placeholder}
              onChange={(e) => onChange(e.target.value)}
            />
          ) : (
            <input id={id} type="text" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
          )}
          {suggestions && suggestions.length > 0 && (
            <div className="chips" aria-label={`Suggestions for ${label}`}>
              {suggestions.map((s) => (
                <button type="button" key={s} className="chip" onClick={() => addSuggestion(s)}>
                  + {s}
                </button>
              ))}
            </div>
          )}
        </>
      )}
    </Field>
  );
}

interface ListProps {
  label: string;
  help?: string;
  items: string[];
  onChange: (items: string[]) => void;
  placeholder?: string;
  addLabel?: string;
  examples?: string[];
}

/** Editable list of one-line strings. Enter adds a new row below; Backspace on an empty row removes it. */
export function List({ label, help, items, onChange, placeholder, addLabel = 'Add item', examples }: ListProps) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  // Row to focus once the next render commits (the input may not exist yet when we ask).
  const pendingFocus = useRef<number | null>(null);
  const focusAt = (i: number) => {
    pendingFocus.current = i;
  };
  useLayoutEffect(() => {
    if (pendingFocus.current === null) return;
    refs.current[pendingFocus.current]?.focus();
    pendingFocus.current = null;
  });

  const set = (i: number, v: string) => onChange(items.map((it, j) => (j === i ? v : it)));
  const insertAfter = (i: number) => {
    onChange([...items.slice(0, i + 1), '', ...items.slice(i + 1)]);
    focusAt(i + 1);
  };
  const remove = (i: number) => {
    onChange(items.filter((_, j) => j !== i));
    focusAt(Math.max(0, i - 1));
  };

  return (
    <div className="field">
      <span className="label">{label}</span>
      {help && <p className="help">{help}</p>}
      <div className="list">
        {items.map((item, i) => (
          <div className="list-row" key={i}>
            <input
              ref={(el) => {
                refs.current[i] = el;
              }}
              type="text"
              aria-label={`${label} ${i + 1}`}
              value={item}
              placeholder={placeholder}
              onChange={(e) => set(i, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  insertAfter(i);
                } else if (e.key === 'Backspace' && item === '' && items.length > 0) {
                  e.preventDefault();
                  remove(i);
                }
              }}
            />
            <button type="button" className="icon-btn" aria-label="Remove" onClick={() => remove(i)}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="ghost-btn" onClick={() => insertAfter(items.length - 1)}>
          + {addLabel}
        </button>
      </div>
      {examples && examples.length > 0 && (
        <div className="chips">
          {examples
            .filter((ex) => !items.includes(ex))
            .map((ex) => (
              <button type="button" key={ex} className="chip" onClick={() => onChange([...items.filter((i) => i.trim()), ex])}>
                + {ex}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  label: string;
  help?: string;
  value: T;
  options: { value: T; label: string; hint?: string }[];
  onChange: (v: T) => void;
}

export function Segmented<T extends string>({ label, help, value, options, onChange }: SegmentedProps<T>) {
  return (
    <div className="field">
      <span className="label">{label}</span>
      {help && <p className="help">{help}</p>}
      <div className="segmented" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            type="button"
            role="radio"
            aria-checked={o.value === value}
            key={o.value}
            className={o.value === value ? 'active' : ''}
            title={o.hint}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}
