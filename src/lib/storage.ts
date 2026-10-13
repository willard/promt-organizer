import { normalizeSpec, type Spec } from './spec';
import { normalizeTemplate, type Template } from './templates';

interface DesktopApi {
  listSpecs(): Promise<unknown[]>;
  saveSpec(spec: Spec): Promise<boolean>;
  deleteSpec(id: string): Promise<boolean>;
  listTemplates(): Promise<unknown[]>;
  saveTemplate(template: Template): Promise<boolean>;
  deleteTemplate(id: string): Promise<boolean>;
  saveText(opts: { defaultName: string; content: string; filters: { name: string; extensions: string[] }[] }): Promise<string | null>;
  openJson(): Promise<string | null>;
  aiStatus(): Promise<AiStatus>;
  aiSetKey(key: string): Promise<AiStatus>;
  aiClearKey(): Promise<AiStatus>;
  aiComplete(req: { system: string; prompt: string; schema: object }): Promise<AiResult>;
}

export interface AiStatus {
  configured: boolean;
  source: 'saved' | 'env' | null;
  /** False when no OS keychain is available and a saved key would be stored in plain text. */
  encrypted: boolean;
}

export type AiResult = { ok: true; text: string; model: string } | { ok: false; error: string };

declare global {
  interface Window {
    api?: DesktopApi;
  }
}

const LS_KEY = 'prompt-organizer:specs';

/** Browser fallback so the UI also runs under `npm run dev:web`. */
function readLocal(): Spec[] {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeLocal(specs: Spec[]) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(specs));
  } catch {
    // Storage full or blocked; drafts just won't persist in the browser build.
  }
}

export const isDesktop = () => typeof window !== 'undefined' && !!window.api;

export async function listSpecs(): Promise<Spec[]> {
  const raw = window.api ? await window.api.listSpecs() : readLocal();
  return raw.map(normalizeSpec).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveSpec(spec: Spec): Promise<void> {
  if (window.api) {
    await window.api.saveSpec(spec);
    return;
  }
  writeLocal([spec, ...readLocal().filter((s) => s.id !== spec.id)]);
}

export async function deleteSpec(id: string): Promise<void> {
  if (window.api) {
    await window.api.deleteSpec(id);
    return;
  }
  writeLocal(readLocal().filter((s) => s.id !== id));
}

const LS_TEMPLATES_KEY = 'prompt-organizer:templates';

function readLocalTemplates(): unknown[] {
  try {
    return JSON.parse(localStorage.getItem(LS_TEMPLATES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeLocalTemplates(templates: Template[]) {
  try {
    localStorage.setItem(LS_TEMPLATES_KEY, JSON.stringify(templates));
  } catch {
    // Storage full or blocked; templates just won't persist in the browser build.
  }
}

/** User-saved templates, newest first. Built-ins live in code, not here. */
export async function listTemplates(): Promise<Template[]> {
  const raw = window.api ? await window.api.listTemplates() : readLocalTemplates();
  return raw
    .map(normalizeTemplate)
    .filter((t): t is Template => t !== null)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function saveTemplate(template: Template): Promise<void> {
  if (window.api) {
    await window.api.saveTemplate(template);
    return;
  }
  const rest = (await listTemplates()).filter((t) => t.id !== template.id);
  writeLocalTemplates([template, ...rest]);
}

export async function deleteTemplate(id: string): Promise<void> {
  if (window.api) {
    await window.api.deleteTemplate(id);
    return;
  }
  writeLocalTemplates((await listTemplates()).filter((t) => t.id !== id));
}

function downloadInBrowser(name: string, content: string, type: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.click();
  URL.revokeObjectURL(url);
}

/** Returns the saved path (desktop), the file name (browser), or null if the user cancelled. */
export async function exportFile(name: string, content: string, kind: 'md' | 'json'): Promise<string | null> {
  const filters =
    kind === 'md' ? [{ name: 'Markdown', extensions: ['md'] }] : [{ name: 'Spec draft', extensions: ['json'] }];
  if (window.api) return window.api.saveText({ defaultName: name, content, filters });
  downloadInBrowser(name, content, kind === 'md' ? 'text/markdown' : 'application/json');
  return name;
}

export async function importDraft(): Promise<Spec | null> {
  let text: string | null = null;
  if (window.api) {
    text = await window.api.openJson();
  } else {
    text = await new Promise<string | null>((resolve) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = () => {
        const file = input.files?.[0];
        if (!file) return resolve(null);
        file.text().then(resolve, () => resolve(null));
      };
      input.click();
    });
  }
  if (!text) return null;
  return normalizeSpec(JSON.parse(text));
}
