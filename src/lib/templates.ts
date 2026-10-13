import { emptySpec, newId, normalizeSpec, type Spec } from './spec';

/** Parts of a spec a template can carry. Name, pitch, summary and open questions are always project-specific. */
export type TemplateSection = 'problem' | 'features' | 'tech' | 'architecture' | 'quality' | 'agent' | 'delivery';

export const SECTION_LABEL: Record<TemplateSection, string> = {
  problem: 'Problem, goals & non-goals',
  features: 'Features & user flows',
  tech: 'Tech stack',
  architecture: 'Architecture & data model',
  quality: 'Quality requirements',
  agent: 'Agent rules & commands',
  delivery: 'Milestones & definition of done',
};

export const ALL_SECTIONS = Object.keys(SECTION_LABEL) as TemplateSection[];

/** Sections that are usually reusable across projects; the rest describe one specific product. */
export const DEFAULT_SECTIONS: TemplateSection[] = ['tech', 'quality', 'agent', 'delivery'];

export interface Template {
  id: string;
  name: string;
  description: string;
  createdAt: string;
  sections: TemplateSection[];
  spec: Spec;
  builtIn?: boolean;
}

/** Copy only the chosen sections of `spec` onto a blank spec. Project type, stage and output format always carry over. */
export function extractTemplateSpec(spec: Spec, sections: TemplateSection[]): Spec {
  const src = structuredClone(spec);
  const out = emptySpec();
  out.target = src.target;
  out.overview.projectType = src.overview.projectType;
  out.overview.stage = src.overview.stage;
  const has = (s: TemplateSection) => sections.includes(s);
  if (has('problem')) out.problem = src.problem;
  if (has('features')) {
    out.features = src.features;
    out.userFlows = src.userFlows;
  }
  if (has('tech')) out.tech = src.tech;
  if (has('architecture')) out.architecture = src.architecture;
  if (has('quality')) out.quality = src.quality;
  if (has('agent')) out.agent = src.agent;
  if (has('delivery')) {
    out.delivery.milestones = src.delivery.milestones;
    out.delivery.definitionOfDone = src.delivery.definitionOfDone;
  }
  return out;
}

export function createTemplate(spec: Spec, name: string, description: string, sections: TemplateSection[]): Template {
  return {
    id: newId(),
    name: name.trim(),
    description: description.trim(),
    createdAt: new Date().toISOString(),
    sections: ALL_SECTIONS.filter((s) => sections.includes(s)),
    spec: extractTemplateSpec(spec, sections),
  };
}

/** A fresh draft from a template: new ids everywhere so it never collides with the template or other drafts. */
export function specFromTemplate(t: Template): Spec {
  const spec = normalizeSpec(structuredClone(t.spec));
  const now = new Date().toISOString();
  spec.id = newId();
  spec.createdAt = now;
  spec.updatedAt = now;
  spec.overview.name = '';
  spec.overview.tagline = '';
  spec.overview.summary = '';
  spec.delivery.openQuestions = [];
  spec.features = spec.features.map((f) => ({ ...f, id: newId() }));
  spec.architecture.entities = spec.architecture.entities.map((e) => ({ ...e, id: newId() }));
  return spec;
}

export function normalizeTemplate(raw: unknown): Template | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Partial<Template>;
  if (typeof r.id !== 'string' || typeof r.name !== 'string' || !r.name.trim()) return null;
  return {
    id: r.id,
    name: r.name,
    description: typeof r.description === 'string' ? r.description : '',
    createdAt: typeof r.createdAt === 'string' ? r.createdAt : new Date(0).toISOString(),
    sections: Array.isArray(r.sections) ? r.sections.filter((s) => ALL_SECTIONS.includes(s)) : [],
    spec: normalizeSpec(r.spec),
  };
}

// --- Built-in templates -----------------------------------------------------

type SpecPatch = {
  [K in keyof Spec]?: Spec[K] extends unknown[] ? Spec[K] : Spec[K] extends object ? Partial<Spec[K]> : Spec[K];
};

function builtIn(id: string, name: string, description: string, patch: SpecPatch): Template {
  const base = emptySpec();
  const spec = normalizeSpec({
    ...base,
    ...patch,
    overview: { ...base.overview, ...patch.overview },
    tech: { ...base.tech, ...patch.tech },
    quality: { ...base.quality, ...patch.quality },
    agent: { ...base.agent, ...patch.agent },
    delivery: { ...base.delivery, ...patch.delivery },
  });
  spec.id = `builtin-${id}`;
  return { id: `builtin-${id}`, name, description, createdAt: '', sections: ['tech', 'quality', 'agent', 'delivery'], spec, builtIn: true };
}

const COMMON_RULES = [
  'Run the test and lint commands before saying a task is done',
  'Keep changes focused on the current milestone',
  'Explain any new dependency in one sentence before adding it',
];

const COMMON_FORBIDDEN = ['Commit secrets, API keys or .env files', 'Delete, skip or weaken failing tests to make them pass'];

export const BUILT_IN_TEMPLATES: Template[] = [
  builtIn('web', 'Web app', 'React + TypeScript frontend with a Node API and Postgres.', {
    overview: { projectType: 'web' },
    tech: {
      languages: 'TypeScript',
      frontend: 'React + Vite, React Router',
      backend: 'Node + Fastify',
      database: 'PostgreSQL with SQL migrations',
      hosting: 'Docker; any container host',
      libraries: 'zod for validation, TanStack Query for data fetching',
      avoid: 'Class components, global CSS frameworks unless asked, ORMs that hide SQL',
    },
    quality: {
      testing: 'Vitest unit tests for logic; API integration tests against a test database; Playwright for key user flows',
      security: 'Validate all input with zod on the server; parameterized SQL only; secrets via env vars',
      accessibility: 'WCAG 2.1 AA; full keyboard navigation',
      errorHandling: 'API returns JSON errors with a stable code; UI shows a readable message and a retry action',
    },
    agent: {
      codeStyle: 'Functional components with hooks; named exports; strict TypeScript, no `any`; Prettier defaults',
      structure: 'apps/\n  web/      React frontend\n  api/      Fastify server\npackages/\n  shared/   types and zod schemas shared by web and api',
      commands: { install: 'npm install', dev: 'npm run dev', test: 'npm test', lint: 'npm run lint', build: 'npm run build' },
      rules: [...COMMON_RULES, 'Share request/response types between web and api through packages/shared'],
      forbidden: [...COMMON_FORBIDDEN, 'Change the database schema without a migration'],
    },
    delivery: {
      milestones: [
        'Repo skeleton: web + api running, lint, tests and CI green',
        'Data model and migrations',
        'Core feature end to end (API + UI)',
        'Remaining Must-have features',
        'Polish: empty states, errors, loading states',
      ],
      definitionOfDone: ['All tests and lint pass', 'Every Must-have feature meets its acceptance criteria', 'README explains setup, env vars and commands'],
    },
  }),
  builtIn('api', 'REST API service', 'Backend-only HTTP API with OpenAPI docs and Postgres.', {
    overview: { projectType: 'api' },
    tech: {
      languages: 'TypeScript',
      backend: 'Node + Fastify',
      database: 'PostgreSQL with SQL migrations',
      hosting: 'Docker container',
      libraries: 'zod for validation, pino for logging, @fastify/swagger for OpenAPI',
    },
    quality: {
      testing: 'Integration tests for every endpoint, including error responses; unit tests for business logic',
      security: 'Authenticate every non-public route; validate every request body and query; rate-limit public routes',
      performance: 'p95 latency under 200 ms for reads at expected load',
      errorHandling: 'Consistent error shape { error: { code, message } } with correct HTTP status codes; structured logs with request id',
    },
    agent: {
      codeStyle: 'One route module per resource; handlers stay thin and call service functions; strict TypeScript',
      structure: 'src/\n  routes/     one file per resource\n  services/   business logic\n  db/         queries and migrations\ntests/',
      commands: { install: 'npm install', dev: 'npm run dev', test: 'npm test', lint: 'npm run lint', build: 'npm run build' },
      rules: [...COMMON_RULES, 'Keep the OpenAPI spec in sync with every route change'],
      forbidden: [...COMMON_FORBIDDEN, 'Return stack traces or internal errors to clients', 'Change the database schema without a migration'],
    },
    delivery: {
      milestones: ['Skeleton with health check, logging, tests and CI', 'Data model and migrations', 'Endpoints for the core resource', 'Auth', 'Remaining endpoints and OpenAPI docs'],
      definitionOfDone: ['All tests and lint pass', 'OpenAPI docs cover every endpoint', 'README explains setup, env vars and how to run locally'],
    },
  }),
  builtIn('cli', 'CLI tool', 'Single-binary command-line tool written in Go.', {
    overview: { projectType: 'cli' },
    tech: {
      languages: 'Go',
      libraries: 'cobra for commands, standard library otherwise',
      hosting: 'GitHub Releases via goreleaser; Homebrew tap',
    },
    quality: {
      testing: 'Table-driven unit tests; golden-file tests for command output',
      errorHandling: 'Errors go to stderr with a non-zero exit code; messages say what went wrong and how to fix it',
      performance: 'Starts in under 100 ms',
    },
    agent: {
      codeStyle: 'gofmt and go vet clean; small packages; return errors, never panic in library code',
      structure: 'cmd/<tool>/   main package\ninternal/      implementation packages\ntestdata/      golden files',
      commands: { install: 'go mod download', dev: 'go run ./cmd/...', test: 'go test ./...', lint: 'go vet ./...', build: 'go build ./...' },
      rules: [...COMMON_RULES, 'Every command has --help text with an example', 'Support --json output for anything scriptable'],
      forbidden: [...COMMON_FORBIDDEN, 'Write to stdout anything other than the command result'],
    },
    delivery: {
      milestones: ['Skeleton: root command, version flag, CI', 'Core command', 'Remaining commands', 'Release pipeline'],
      definitionOfDone: ['go test ./... and go vet pass', 'Every command documented in README with examples'],
    },
  }),
  builtIn('desktop', 'Desktop app', 'Cross-platform Electron + React app with local storage.', {
    overview: { projectType: 'desktop' },
    tech: {
      languages: 'TypeScript',
      frontend: 'Electron + React + Vite',
      database: 'JSON files in the app user-data folder',
      hosting: 'electron-builder installers on GitHub Releases',
    },
    quality: {
      testing: 'Vitest for logic; Playwright Electron tests for main flows',
      security: 'contextIsolation on, nodeIntegration off, sandboxed renderer; expose a minimal preload API',
      accessibility: 'Full keyboard navigation; follows OS light/dark theme',
      errorHandling: 'Never lose user data: write files atomically and surface save errors',
    },
    agent: {
      codeStyle: 'Main process stays small; all UI logic in the renderer; strict TypeScript',
      structure: 'electron/   main and preload\nsrc/\n  components/\n  lib/      pure logic, unit-tested',
      commands: { install: 'npm install', dev: 'npm run dev', test: 'npm test', lint: 'npm run lint', build: 'npm run build' },
      rules: [...COMMON_RULES, 'Every IPC channel is listed in preload and validated in main'],
      forbidden: [...COMMON_FORBIDDEN, 'Enable nodeIntegration or remote module', 'Load remote content in the app window'],
    },
    delivery: {
      milestones: ['Window, preload bridge, build and CI', 'Core screen and local persistence', 'Remaining features', 'Installers for macOS, Windows, Linux'],
      definitionOfDone: ['Tests pass', 'App builds installers for all three platforms', 'README covers dev setup and packaging'],
    },
  }),
  builtIn('library', 'Library / SDK', 'Published TypeScript package with typed public API.', {
    overview: { projectType: 'library' },
    tech: {
      languages: 'TypeScript',
      hosting: 'npm',
      libraries: 'tsup for bundling (ESM + CJS), Vitest',
      avoid: 'Runtime dependencies unless essential',
    },
    quality: {
      testing: 'Unit tests for every public function, including edge cases; type tests for the public API',
      performance: 'Tree-shakeable; no side effects on import',
    },
    agent: {
      codeStyle: 'Every export has a TSDoc comment with an example; no default exports',
      structure: 'src/\n  index.ts   public API only\n  internal/\ntests/',
      commands: { install: 'npm install', dev: '', test: 'npm test', lint: 'npm run lint', build: 'npm run build' },
      rules: [...COMMON_RULES, 'Treat every exported name as public API; note breaking changes in CHANGELOG.md'],
      forbidden: [...COMMON_FORBIDDEN, 'Export internals from src/index.ts'],
    },
    delivery: {
      milestones: ['Package skeleton, build, tests, CI', 'Core API', 'Docs and examples', 'First release'],
      definitionOfDone: ['Tests, lint and type checks pass', 'README has install and usage examples for every public function'],
    },
  }),
];
