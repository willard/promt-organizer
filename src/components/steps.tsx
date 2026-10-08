import type { ReactNode } from 'react';
import { List, Segmented, Text } from './fields';
import {
  PROJECT_TYPES,
  STACK_SUGGESTIONS,
  TARGETS,
  emptyEntity,
  emptyFeature,
  type Priority,
  type Spec,
} from '../lib/spec';

export type Update = (fn: (draft: Spec) => void) => void;

export interface StepProps {
  spec: Spec;
  update: Update;
}

export interface Step {
  id: string;
  title: string;
  question: string;
  render: (p: StepProps) => ReactNode;
}

function Overview({ spec, update }: StepProps) {
  const o = spec.overview;
  return (
    <>
      <Text label="Project name" value={o.name} placeholder="e.g. Recipe Box" onChange={(v) => update((d) => void (d.overview.name = v))} />
      <Text
        label="One-line pitch"
        help="If you had one sentence to explain it to another developer."
        value={o.tagline}
        placeholder="A personal recipe manager that imports recipes from any URL."
        onChange={(v) => update((d) => void (d.overview.tagline = v))}
      />
      <Segmented
        label="What kind of software is it?"
        value={o.projectType}
        options={PROJECT_TYPES}
        onChange={(v) => update((d) => void (d.overview.projectType = v))}
      />
      <Segmented
        label="Starting point"
        value={o.stage}
        options={[
          { value: 'new', label: 'New project' },
          { value: 'existing', label: 'Existing codebase' },
        ]}
        onChange={(v) => update((d) => void (d.overview.stage = v))}
      />
      <Text
        label="Summary"
        help="A short paragraph: what it does, the main screens or commands, and what success looks like."
        multiline
        rows={5}
        value={o.summary}
        onChange={(v) => update((d) => void (d.overview.summary = v))}
      />
    </>
  );
}

function Problem({ spec, update }: StepProps) {
  const p = spec.problem;
  return (
    <>
      <Text
        label="What problem does it solve?"
        help="Describe the pain today, before this software exists."
        multiline
        value={p.problem}
        placeholder="I save recipes in bookmarks, screenshots and notes, and can never find them when cooking."
        onChange={(v) => update((d) => void (d.problem.problem = v))}
      />
      <Text
        label="Who are the users?"
        help="Roles, technical level, devices they use, how many of them."
        value={p.users}
        placeholder="Home cooks on phone and laptop; single user per account."
        onChange={(v) => update((d) => void (d.problem.users = v))}
      />
      <List
        label="Goals"
        help="Outcomes, not features. What must be true when this is done?"
        items={p.goals}
        placeholder="Find any saved recipe in under 5 seconds"
        addLabel="Add goal"
        onChange={(v) => update((d) => void (d.problem.goals = v))}
      />
      <List
        label="Non-goals"
        help="Things the agent should explicitly NOT build. This prevents scope creep."
        items={p.nonGoals}
        placeholder="Social features / sharing"
        addLabel="Add non-goal"
        examples={['User accounts / authentication', 'Payments', 'Mobile app', 'Internationalization']}
        onChange={(v) => update((d) => void (d.problem.nonGoals = v))}
      />
    </>
  );
}

const PRIORITIES: { value: Priority; label: string }[] = [
  { value: 'must', label: 'Must' },
  { value: 'should', label: 'Should' },
  { value: 'could', label: 'Nice to have' },
];

function Features({ spec, update }: StepProps) {
  return (
    <>
      {spec.features.length === 0 && (
        <p className="empty">No features yet. Add the first thing a user should be able to do.</p>
      )}
      {spec.features.map((f, i) => (
        <fieldset className="card" key={f.id}>
          <legend>Feature {i + 1}</legend>
          <div className="card-actions">
            <button
              type="button"
              className="icon-btn"
              aria-label="Move up"
              disabled={i === 0}
              onClick={() => update((d) => void d.features.splice(i - 1, 0, d.features.splice(i, 1)[0]))}
            >
              ↑
            </button>
            <button
              type="button"
              className="icon-btn"
              aria-label="Move down"
              disabled={i === spec.features.length - 1}
              onClick={() => update((d) => void d.features.splice(i + 1, 0, d.features.splice(i, 1)[0]))}
            >
              ↓
            </button>
            <button type="button" className="icon-btn danger" aria-label="Delete feature" onClick={() => update((d) => void d.features.splice(i, 1))}>
              ×
            </button>
          </div>
          <Text label="Title" value={f.title} placeholder="Import recipe from URL" onChange={(v) => update((d) => void (d.features[i].title = v))} />
          <Segmented label="Priority" value={f.priority} options={PRIORITIES} onChange={(v) => update((d) => void (d.features[i].priority = v))} />
          <Text
            label="Description"
            multiline
            rows={3}
            value={f.description}
            placeholder="User pastes a URL; the app extracts title, ingredients, steps and image."
            onChange={(v) => update((d) => void (d.features[i].description = v))}
          />
          <List
            label="Acceptance criteria"
            help="Testable statements. How will you know it works?"
            items={f.acceptance}
            placeholder="Given a valid recipe URL, ingredients are saved as a list"
            addLabel="Add criterion"
            onChange={(v) => update((d) => void (d.features[i].acceptance = v))}
          />
        </fieldset>
      ))}
      <button type="button" className="secondary-btn" onClick={() => update((d) => void d.features.push(emptyFeature()))}>
        + Add feature
      </button>
      <List
        label="Key user flows"
        help="Step-by-step journeys through the app, one per line."
        items={spec.userFlows}
        placeholder="Open app → paste URL → review parsed recipe → save → appears in list"
        addLabel="Add flow"
        onChange={(v) => update((d) => void (d.userFlows = v))}
      />
    </>
  );
}

function Tech({ spec, update }: StepProps) {
  const t = spec.tech;
  const sug = STACK_SUGGESTIONS[spec.overview.projectType];
  const set = (k: keyof Spec['tech']) => (v: string) => update((d) => void (d.tech[k] = v));
  return (
    <>
      <p className="help">Leave a field empty to let the agent decide. Click a suggestion to add it.</p>
      <Text label="Languages" value={t.languages} suggestions={sug.languages} onChange={set('languages')} />
      <Text label="Frontend / UI framework" value={t.frontend} suggestions={sug.frontend} onChange={set('frontend')} />
      <Text label="Backend" value={t.backend} suggestions={sug.backend} onChange={set('backend')} />
      <Text label="Database / storage" value={t.database} suggestions={sug.database} onChange={set('database')} />
      <Text label="Hosting / distribution" value={t.hosting} suggestions={sug.hosting} onChange={set('hosting')} />
      <Text
        label="Libraries to use"
        help="Specific packages you want, with versions if they matter."
        value={t.libraries}
        suggestions={sug.libraries}
        placeholder="zod for validation, date-fns, Tailwind CSS v4"
        onChange={set('libraries')}
      />
      <Text
        label="Avoid"
        help="Technologies or patterns the agent must not introduce."
        value={t.avoid}
        placeholder="No ORMs, no class components, no jQuery"
        onChange={set('avoid')}
      />
    </>
  );
}

function Architecture({ spec, update }: StepProps) {
  const a = spec.architecture;
  return (
    <>
      <Text
        label="Architecture overview"
        help="Main components and how they talk to each other. Skip if you want the agent to propose one."
        multiline
        value={a.overview}
        placeholder="React SPA talks to a REST API; API stores data in Postgres; a background worker fetches and parses recipe URLs."
        onChange={(v) => update((d) => void (d.architecture.overview = v))}
      />
      <div className="field">
        <span className="label">Data model</span>
        <p className="help">The main things the app stores, and their important fields.</p>
        {a.entities.map((e, i) => (
          <div className="entity-row" key={e.id}>
            <input
              type="text"
              aria-label={`Entity ${i + 1} name`}
              placeholder="Recipe"
              value={e.name}
              onChange={(ev) => update((d) => void (d.architecture.entities[i].name = ev.target.value))}
            />
            <input
              type="text"
              aria-label={`Entity ${i + 1} fields`}
              placeholder="id, title, sourceUrl, ingredients[], steps[], createdAt"
              value={e.fields}
              onChange={(ev) => update((d) => void (d.architecture.entities[i].fields = ev.target.value))}
            />
            <button type="button" className="icon-btn" aria-label="Remove entity" onClick={() => update((d) => void d.architecture.entities.splice(i, 1))}>
              ×
            </button>
          </div>
        ))}
        <button type="button" className="ghost-btn" onClick={() => update((d) => void d.architecture.entities.push(emptyEntity()))}>
          + Add entity
        </button>
      </div>
      <List
        label="External integrations"
        help="Third-party APIs, auth providers, payment, email, etc."
        items={a.integrations}
        placeholder="OpenAI API for ingredient parsing"
        addLabel="Add integration"
        onChange={(v) => update((d) => void (d.architecture.integrations = v))}
      />
      <Text
        label="API / interfaces"
        help="Endpoints, CLI commands, or public functions — whatever the outside world calls."
        multiline
        mono
        value={a.api}
        placeholder={'GET  /api/recipes\nPOST /api/recipes/import { url }'}
        onChange={(v) => update((d) => void (d.architecture.api = v))}
      />
    </>
  );
}

function Quality({ spec, update }: StepProps) {
  const q = spec.quality;
  const set = (k: keyof Spec['quality']) => (v: string) => update((d) => void (d.quality[k] = v));
  return (
    <>
      <Text
        label="Testing"
        help="Which kinds of tests, which framework, any coverage target."
        value={q.testing}
        suggestions={['Unit tests for business logic', 'Integration tests for the API', 'E2E with Playwright', 'Vitest', 'pytest']}
        onChange={set('testing')}
      />
      <Text
        label="Security"
        value={q.security}
        suggestions={['Validate all user input', 'Secrets only via env vars', 'Parameterized SQL only', 'Auth on every API route']}
        onChange={set('security')}
      />
      <Text
        label="Performance"
        help="Use numbers: response times, list sizes, bundle size."
        value={q.performance}
        placeholder="List of 1,000 recipes renders in < 200 ms"
        onChange={set('performance')}
      />
      <Text
        label="Accessibility"
        value={q.accessibility}
        suggestions={['WCAG 2.1 AA', 'Full keyboard navigation', 'Dark mode']}
        onChange={set('accessibility')}
      />
      <Text
        label="Error handling & logging"
        value={q.errorHandling}
        placeholder="Show a friendly message on failure; never swallow errors silently; log to console in dev only"
        onChange={set('errorHandling')}
      />
    </>
  );
}

function Agent({ spec, update }: StepProps) {
  const a = spec.agent;
  const setCmd = (k: keyof Spec['agent']['commands']) => (v: string) => update((d) => void (d.agent.commands[k] = v));
  return (
    <>
      <Segmented
        label="How should the agent work?"
        value={a.workflow}
        options={[
          { value: 'plan-first', label: 'Plan first, then build', hint: 'Agent proposes a plan and waits for approval' },
          { value: 'iterate', label: 'Build milestone by milestone' },
          { value: 'tdd', label: 'Test-driven' },
        ]}
        onChange={(v) => update((d) => void (d.agent.workflow = v))}
      />
      <label className="checkbox">
        <input type="checkbox" checked={a.askWhenUnsure} onChange={(e) => update((d) => void (d.agent.askWhenUnsure = e.target.checked))} />
        Ask me before making hard-to-reverse assumptions
      </label>
      <div className="grid-2">
        <Text label="Install command" value={a.commands.install} placeholder="npm install" onChange={setCmd('install')} />
        <Text label="Dev / run command" value={a.commands.dev} placeholder="npm run dev" onChange={setCmd('dev')} />
        <Text label="Test command" value={a.commands.test} placeholder="npm test" onChange={setCmd('test')} />
        <Text label="Lint / format command" value={a.commands.lint} placeholder="npm run lint" onChange={setCmd('lint')} />
        <Text label="Build command" value={a.commands.build} placeholder="npm run build" onChange={setCmd('build')} />
      </div>
      <Text
        label="Code style"
        help="Naming, formatting, patterns you prefer."
        multiline
        rows={3}
        value={a.codeStyle}
        placeholder="Functional React components with hooks; named exports; Prettier defaults; no `any`."
        onChange={(v) => update((d) => void (d.agent.codeStyle = v))}
      />
      <Text
        label="Folder structure"
        help="Expected or existing layout of the repo."
        multiline
        mono
        rows={5}
        value={a.structure}
        placeholder={'src/\n  components/\n  lib/\n  routes/\ntests/'}
        onChange={(v) => update((d) => void (d.agent.structure = v))}
      />
      <List
        label="Always"
        help="Rules the agent must follow."
        items={a.rules}
        addLabel="Add rule"
        examples={['Run tests before saying a task is done', 'Keep functions small and focused', 'Update the README when behavior changes', 'Write commit messages in imperative mood']}
        onChange={(v) => update((d) => void (d.agent.rules = v))}
      />
      <List
        label="Never"
        help="Hard limits."
        items={a.forbidden}
        addLabel="Add limit"
        examples={['Commit secrets or API keys', 'Add a dependency without saying why', 'Delete or skip failing tests', 'Change the database schema without a migration']}
        onChange={(v) => update((d) => void (d.agent.forbidden = v))}
      />
    </>
  );
}

function Delivery({ spec, update }: StepProps) {
  const d0 = spec.delivery;
  return (
    <>
      <List
        label="Milestones"
        help="Ordered chunks of work. Each one should leave the app in a working state."
        items={d0.milestones}
        placeholder="Project skeleton with lint, test and CI"
        addLabel="Add milestone"
        onChange={(v) => update((d) => void (d.delivery.milestones = v))}
      />
      <List
        label="Definition of done"
        items={d0.definitionOfDone}
        addLabel="Add check"
        examples={['All tests pass', 'No lint or type errors', 'README explains setup and usage', 'Every Must-have feature meets its acceptance criteria']}
        onChange={(v) => update((d) => void (d.delivery.definitionOfDone = v))}
      />
      <List
        label="Open questions"
        help="Things you have not decided yet. The agent will flag or ask about them."
        items={d0.openQuestions}
        placeholder="Should recipes be shareable via public link?"
        addLabel="Add question"
        onChange={(v) => update((d) => void (d.delivery.openQuestions = v))}
      />
    </>
  );
}

function Output({ spec, update }: StepProps) {
  return (
    <Segmented
      label="Output format"
      help={TARGETS.find((t) => t.value === spec.target)?.hint}
      value={spec.target}
      options={TARGETS.map((t) => ({ value: t.value, label: `${t.label} (${t.file})` }))}
      onChange={(v) => update((d) => void (d.target = v))}
    />
  );
}

export const STEPS: Step[] = [
  { id: 'overview', title: 'Overview', question: 'What are you building?', render: (p) => <Overview {...p} /> },
  { id: 'problem', title: 'Problem & users', question: 'Why does it need to exist, and for whom?', render: (p) => <Problem {...p} /> },
  { id: 'features', title: 'Features', question: 'What should users be able to do?', render: (p) => <Features {...p} /> },
  { id: 'tech', title: 'Tech stack', question: 'What should it be built with?', render: (p) => <Tech {...p} /> },
  { id: 'architecture', title: 'Architecture', question: 'How do the pieces fit together?', render: (p) => <Architecture {...p} /> },
  { id: 'quality', title: 'Quality', question: 'What does "good enough" mean?', render: (p) => <Quality {...p} /> },
  { id: 'agent', title: 'Agent rules', question: 'How should the AI agent work in this project?', render: (p) => <Agent {...p} /> },
  { id: 'delivery', title: 'Delivery', question: 'How will you know it is done?', render: (p) => <Delivery {...p} /> },
  { id: 'review', title: 'Review & export', question: 'Check the spec and export it.', render: (p) => <Output {...p} /> },
];
