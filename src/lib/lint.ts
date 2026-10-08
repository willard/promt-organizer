import type { Spec } from './spec';

export type Severity = 'error' | 'warning' | 'tip';

export interface Issue {
  severity: Severity;
  step: string;
  message: string;
}

/** Words that read fine to humans but leave an AI agent guessing. */
const VAGUE_WORDS = [
  'fast',
  'simple',
  'easy',
  'user-friendly',
  'intuitive',
  'modern',
  'scalable',
  'robust',
  'nice',
  'clean',
  'etc',
  'and so on',
  'various',
  'good',
  'seamless',
];

const vagueRe = new RegExp(`\\b(${VAGUE_WORDS.map((w) => w.replace(/[-]/g, '\\-')).join('|')})\\b`, 'gi');

export function findVagueWords(text: string): string[] {
  const found = new Set<string>();
  for (const m of text.matchAll(vagueRe)) found.add(m[1].toLowerCase());
  return [...found];
}

const blank = (s: string) => !s || !s.trim();

/** Check a spec for gaps that commonly make an AI agent produce the wrong thing. */
export function lintSpec(spec: Spec): Issue[] {
  const issues: Issue[] = [];
  const add = (severity: Severity, step: string, message: string) => issues.push({ severity, step, message });

  if (blank(spec.overview.name)) add('error', 'overview', 'Give the project a name.');
  if (blank(spec.overview.summary)) add('warning', 'overview', 'Add a short summary of what the project does.');

  if (blank(spec.problem.problem)) add('warning', 'problem', 'Describe the problem being solved.');
  if (blank(spec.problem.users)) add('warning', 'problem', 'Say who the users are.');
  if (!spec.problem.nonGoals.some((g) => g.trim()))
    add('tip', 'problem', 'List a few non-goals so the agent does not over-build.');

  const features = spec.features.filter((f) => f.title.trim());
  if (!features.length) add('error', 'features', 'Add at least one feature.');
  if (features.length && !features.some((f) => f.priority === 'must'))
    add('warning', 'features', 'Mark at least one feature as "Must have".');
  for (const f of features) {
    if (!f.acceptance.some((a) => a.trim()))
      add('warning', 'features', `"${f.title.trim()}" has no acceptance criteria — the agent cannot tell when it is done.`);
  }

  const t = spec.tech;
  if (blank(t.languages) && blank(t.frontend) && blank(t.backend))
    add('warning', 'tech', 'Pick a language or framework, or the agent will choose one for you.');
  if (spec.overview.projectType === 'web' && blank(t.database) && blank(t.backend))
    add('tip', 'tech', 'Web app with no backend or database — say "none" if that is intentional.');

  if (blank(spec.quality.testing)) add('warning', 'quality', 'Say how the code should be tested.');

  if (blank(spec.agent.commands.test) && !blank(spec.quality.testing))
    add('tip', 'agent', 'Add the test command so the agent can verify its own work.');
  if (spec.overview.stage === 'existing' && blank(spec.agent.structure))
    add('warning', 'agent', 'Existing codebase: describe the folder structure so the agent edits the right files.');

  if (!spec.delivery.definitionOfDone.some((d) => d.trim()))
    add('tip', 'delivery', 'Add a definition of done (e.g. "all tests pass", "README updated").');

  const prose: [string, string][] = [
    ['overview', spec.overview.summary],
    ['problem', spec.problem.problem],
    ...spec.features.map((f): [string, string] => ['features', `${f.description} ${f.acceptance.join(' ')}`]),
    ['quality', Object.values(spec.quality).join(' ')],
  ];
  const vagueByStep = new Map<string, Set<string>>();
  for (const [step, text] of prose) {
    for (const w of findVagueWords(text)) {
      if (!vagueByStep.has(step)) vagueByStep.set(step, new Set());
      vagueByStep.get(step)!.add(w);
    }
  }
  for (const [step, words] of vagueByStep) {
    add('tip', step, `Vague wording: ${[...words].map((w) => `"${w}"`).join(', ')}. Replace with something measurable.`);
  }

  return issues;
}

/** 0–100 score: rough measure of how much an agent has to guess. */
export function completeness(spec: Spec): number {
  const checks = [
    !blank(spec.overview.name),
    !blank(spec.overview.summary),
    !blank(spec.problem.problem),
    !blank(spec.problem.users),
    spec.problem.goals.some((g) => g.trim()),
    spec.problem.nonGoals.some((g) => g.trim()),
    spec.features.some((f) => f.title.trim()),
    spec.features.length > 0 && spec.features.every((f) => !f.title.trim() || f.acceptance.some((a) => a.trim())),
    spec.userFlows.some((f) => f.trim()),
    !blank(spec.tech.languages) || !blank(spec.tech.frontend) || !blank(spec.tech.backend),
    !blank(spec.tech.database) || !blank(spec.tech.hosting),
    !blank(spec.architecture.overview) || spec.architecture.entities.some((e) => e.name.trim()),
    !blank(spec.quality.testing),
    !blank(spec.quality.security) || !blank(spec.quality.errorHandling),
    Object.values(spec.agent.commands).some((c) => c.trim()),
    spec.agent.rules.some((r) => r.trim()) || spec.agent.forbidden.some((r) => r.trim()),
    spec.delivery.milestones.some((m) => m.trim()),
    spec.delivery.definitionOfDone.some((d) => d.trim()),
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}
