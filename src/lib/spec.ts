export type Priority = 'must' | 'should' | 'could';

export type ProjectType = 'web' | 'api' | 'cli' | 'desktop' | 'mobile' | 'library' | 'other';

export type OutputTarget = 'spec' | 'claude' | 'agents';

export interface Feature {
  id: string;
  title: string;
  description: string;
  priority: Priority;
  acceptance: string[];
}

export interface Entity {
  id: string;
  name: string;
  fields: string;
}

export interface Spec {
  id: string;
  createdAt: string;
  updatedAt: string;
  target: OutputTarget;
  overview: {
    name: string;
    tagline: string;
    projectType: ProjectType;
    stage: 'new' | 'existing';
    summary: string;
  };
  problem: {
    problem: string;
    users: string;
    goals: string[];
    nonGoals: string[];
  };
  features: Feature[];
  userFlows: string[];
  tech: {
    languages: string;
    frontend: string;
    backend: string;
    database: string;
    hosting: string;
    libraries: string;
    avoid: string;
  };
  architecture: {
    overview: string;
    entities: Entity[];
    integrations: string[];
    api: string;
  };
  quality: {
    testing: string;
    security: string;
    performance: string;
    accessibility: string;
    errorHandling: string;
  };
  agent: {
    codeStyle: string;
    structure: string;
    commands: { install: string; dev: string; test: string; lint: string; build: string };
    rules: string[];
    forbidden: string[];
    workflow: 'plan-first' | 'iterate' | 'tdd';
    askWhenUnsure: boolean;
  };
  delivery: {
    milestones: string[];
    definitionOfDone: string[];
    openQuestions: string[];
  };
}

export const PROJECT_TYPES: { value: ProjectType; label: string }[] = [
  { value: 'web', label: 'Web app' },
  { value: 'api', label: 'API / backend service' },
  { value: 'cli', label: 'CLI tool' },
  { value: 'desktop', label: 'Desktop app' },
  { value: 'mobile', label: 'Mobile app' },
  { value: 'library', label: 'Library / SDK' },
  { value: 'other', label: 'Other' },
];

export const TARGETS: { value: OutputTarget; label: string; file: string; hint: string }[] = [
  { value: 'spec', label: 'Project spec', file: 'SPEC.md', hint: 'Paste into any AI chat or agent as the first message.' },
  { value: 'claude', label: 'Claude Code', file: 'CLAUDE.md', hint: 'Drop in the repo root; Claude Code reads it automatically.' },
  { value: 'agents', label: 'AGENTS.md', file: 'AGENTS.md', hint: 'Open standard read by Codex, Cursor, Jules and others.' },
];

/** Quick-pick suggestions shown as chips under the tech-stack fields, per project type. */
export const STACK_SUGGESTIONS: Record<ProjectType, Partial<Record<keyof Spec['tech'], string[]>>> = {
  web: {
    languages: ['TypeScript'],
    frontend: ['React + Vite', 'Next.js', 'SvelteKit', 'Vue + Nuxt'],
    backend: ['Node + Express', 'Next.js route handlers', 'FastAPI', 'Django'],
    database: ['PostgreSQL', 'SQLite', 'Supabase', 'MongoDB'],
    hosting: ['Vercel', 'Fly.io', 'Cloudflare', 'AWS'],
  },
  api: {
    languages: ['TypeScript', 'Python', 'Go', 'Rust'],
    backend: ['Fastify', 'FastAPI', 'Go net/http', 'Axum'],
    database: ['PostgreSQL', 'Redis', 'SQLite'],
    hosting: ['Docker + Fly.io', 'AWS Lambda', 'Google Cloud Run'],
  },
  cli: {
    languages: ['Go', 'Rust', 'Python', 'TypeScript'],
    libraries: ['cobra', 'clap', 'typer', 'commander'],
    hosting: ['GitHub Releases', 'Homebrew tap', 'npm', 'PyPI'],
  },
  desktop: {
    languages: ['TypeScript', 'Rust'],
    frontend: ['Electron + React', 'Tauri + React', 'Tauri + Svelte'],
    database: ['SQLite', 'JSON files in user data dir'],
    hosting: ['GitHub Releases', 'electron-builder installers'],
  },
  mobile: {
    languages: ['TypeScript', 'Dart', 'Swift', 'Kotlin'],
    frontend: ['React Native + Expo', 'Flutter', 'SwiftUI', 'Jetpack Compose'],
    backend: ['Supabase', 'Firebase', 'Custom REST API'],
    database: ['SQLite', 'Realm', 'Firestore'],
  },
  library: {
    languages: ['TypeScript', 'Python', 'Rust', 'Go'],
    hosting: ['npm', 'PyPI', 'crates.io', 'Go modules'],
  },
  other: {},
};

export const newId = () =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);

export function emptyFeature(): Feature {
  return { id: newId(), title: '', description: '', priority: 'must', acceptance: [] };
}

export function emptyEntity(): Entity {
  return { id: newId(), name: '', fields: '' };
}

export function emptySpec(): Spec {
  const now = new Date().toISOString();
  return {
    id: newId(),
    createdAt: now,
    updatedAt: now,
    target: 'spec',
    overview: { name: '', tagline: '', projectType: 'web', stage: 'new', summary: '' },
    problem: { problem: '', users: '', goals: [], nonGoals: [] },
    features: [],
    userFlows: [],
    tech: { languages: '', frontend: '', backend: '', database: '', hosting: '', libraries: '', avoid: '' },
    architecture: { overview: '', entities: [], integrations: [], api: '' },
    quality: { testing: '', security: '', performance: '', accessibility: '', errorHandling: '' },
    agent: {
      codeStyle: '',
      structure: '',
      commands: { install: '', dev: '', test: '', lint: '', build: '' },
      rules: [],
      forbidden: [],
      workflow: 'plan-first',
      askWhenUnsure: true,
    },
    delivery: { milestones: [], definitionOfDone: [], openQuestions: [] },
  };
}

/**
 * Fill in any fields missing from an older or hand-edited draft so the UI never reads undefined.
 */
export function normalizeSpec(raw: unknown): Spec {
  const base = emptySpec();
  if (!raw || typeof raw !== 'object') return base;
  const r = raw as Partial<Spec>;
  return {
    ...base,
    ...r,
    overview: { ...base.overview, ...r.overview },
    problem: { ...base.problem, ...r.problem },
    tech: { ...base.tech, ...r.tech },
    architecture: { ...base.architecture, ...r.architecture },
    quality: { ...base.quality, ...r.quality },
    agent: {
      ...base.agent,
      ...r.agent,
      commands: { ...base.agent.commands, ...r.agent?.commands },
    },
    delivery: { ...base.delivery, ...r.delivery },
    features: Array.isArray(r.features) ? r.features.map((f) => ({ ...emptyFeature(), ...f })) : [],
    userFlows: Array.isArray(r.userFlows) ? r.userFlows : [],
  };
}

export function fileNameFor(spec: Spec): string {
  return TARGETS.find((t) => t.value === spec.target)?.file ?? 'SPEC.md';
}
