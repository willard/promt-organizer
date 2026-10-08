import { PROJECT_TYPES, type Priority, type Spec } from './spec';

const PRIORITY_LABEL: Record<Priority, string> = {
  must: 'Must have',
  should: 'Should have',
  could: 'Nice to have',
};

const WORKFLOW_TEXT: Record<Spec['agent']['workflow'], string> = {
  'plan-first':
    'Before writing code, read this whole document and reply with a short implementation plan (files to create or change, order of work). Wait for confirmation, then implement one milestone at a time.',
  iterate:
    'Start implementing right away, one milestone at a time. After each milestone, summarize what changed and how to verify it.',
  tdd: 'Work test-first: for each feature, write failing tests from its acceptance criteria, then implement until they pass.',
};

const clean = (s: string | undefined) => (s ?? '').trim();
const items = (list: string[]) => list.map(clean).filter(Boolean);

function section(title: string, body: string[]): string[] {
  if (!body.some((line) => line.trim())) return [];
  return [`## ${title}`, '', ...body, ''];
}

function bullets(list: string[], prefix = '- '): string[] {
  return items(list).map((i) => `${prefix}${i}`);
}

function field(label: string, value: string): string[] {
  const v = clean(value);
  return v ? [`- **${label}:** ${v}`] : [];
}

function sub(title: string, lines: string[]): string[] {
  return lines.length ? [`### ${title}`, '', ...lines, ''] : [];
}

/** Render a spec as a Markdown document meant to be handed to an AI coding agent. */
export function generateMarkdown(spec: Spec): string {
  const { overview, problem, tech, architecture, quality, agent, delivery } = spec;
  const name = clean(overview.name) || 'Untitled project';
  const typeLabel = PROJECT_TYPES.find((t) => t.value === overview.projectType)?.label ?? overview.projectType;
  const out: string[] = [];

  out.push(`# ${name}`, '');
  if (clean(overview.tagline)) out.push(`> ${clean(overview.tagline)}`, '');

  if (spec.target === 'claude') {
    out.push('This file gives Claude Code the context and rules for working in this repository.', '');
  } else if (spec.target === 'agents') {
    out.push('Instructions and project context for AI coding agents working in this repository.', '');
  } else {
    out.push(
      'You are an expert software engineer. Build the project described below. Treat this document as the source of truth; when something is not specified, choose the simplest reasonable option and note the assumption.',
      '',
    );
  }

  out.push(
    ...section('Overview', [
      `- **Type:** ${typeLabel}`,
      `- **Stage:** ${overview.stage === 'existing' ? 'Existing codebase — extend it, do not rewrite it' : 'New project, starting from scratch'}`,
      ...(clean(overview.summary) ? ['', clean(overview.summary)] : []),
    ]),
  );

  out.push(
    ...section('Problem & users', [
      ...(clean(problem.problem) ? [clean(problem.problem), ''] : []),
      ...field('Target users', problem.users),
      ...(items(problem.goals).length ? ['', '**Goals**', '', ...bullets(problem.goals)] : []),
      ...(items(problem.nonGoals).length ? ['', '**Non-goals (do not build)**', '', ...bullets(problem.nonGoals)] : []),
    ]),
  );

  const features = spec.features.filter((f) => clean(f.title));
  if (features.length) {
    const lines: string[] = [];
    for (const p of ['must', 'should', 'could'] as Priority[]) {
      const group = features.filter((f) => f.priority === p);
      if (!group.length) continue;
      lines.push(`### ${PRIORITY_LABEL[p]}`, '');
      group.forEach((f) => {
        lines.push(`#### ${clean(f.title)}`, '');
        if (clean(f.description)) lines.push(clean(f.description), '');
        const ac = items(f.acceptance);
        if (ac.length) lines.push('Acceptance criteria:', '', ...ac.map((a) => `- [ ] ${a}`), '');
      });
    }
    while (lines.at(-1) === '') lines.pop();
    out.push(...section('Features', lines));
  }

  out.push(...section('Key user flows', items(spec.userFlows).map((f, i) => `${i + 1}. ${f}`)));

  out.push(
    ...section('Tech stack', [
      ...field('Languages', tech.languages),
      ...field('Frontend / UI', tech.frontend),
      ...field('Backend', tech.backend),
      ...field('Database / storage', tech.database),
      ...field('Hosting / distribution', tech.hosting),
      ...field('Libraries to use', tech.libraries),
      ...field('Avoid', tech.avoid),
    ]),
  );

  const entities = architecture.entities.filter((e) => clean(e.name));
  out.push(
    ...section('Architecture', [
      ...(clean(architecture.overview) ? [clean(architecture.overview), ''] : []),
      ...sub(
        'Data model',
        entities.map((e) => `- **${clean(e.name)}**${clean(e.fields) ? `: ${clean(e.fields)}` : ''}`),
      ),
      ...sub('External integrations', bullets(architecture.integrations)),
      ...sub('API / interfaces', clean(architecture.api) ? [clean(architecture.api)] : []),
    ]),
  );

  out.push(
    ...section('Quality requirements', [
      ...field('Testing', quality.testing),
      ...field('Security', quality.security),
      ...field('Performance', quality.performance),
      ...field('Accessibility', quality.accessibility),
      ...field('Error handling', quality.errorHandling),
    ]),
  );

  const cmds = agent.commands;
  const cmdLines = (
    [
      ['Install', cmds.install],
      ['Run (dev)', cmds.dev],
      ['Test', cmds.test],
      ['Lint / format', cmds.lint],
      ['Build', cmds.build],
    ] as const
  )
    .filter(([, c]) => clean(c))
    .map(([label, c]) => `- ${label}: \`${clean(c)}\``);

  out.push(
    ...section('Working agreement for the AI agent', [
      ...sub('Workflow', [
        WORKFLOW_TEXT[agent.workflow],
        ...(agent.askWhenUnsure
          ? ['', 'If a requirement is ambiguous or missing and the choice is hard to reverse, stop and ask instead of guessing.']
          : []),
      ]),
      ...sub('Commands', cmdLines),
      ...sub('Code style', clean(agent.codeStyle) ? [clean(agent.codeStyle)] : []),
      ...sub('Project structure', clean(agent.structure) ? ['```', clean(agent.structure), '```'] : []),
      ...sub('Always', bullets(agent.rules)),
      ...sub('Never', bullets(agent.forbidden)),
    ]),
  );

  out.push(
    ...section('Delivery plan', [
      ...sub('Milestones', items(delivery.milestones).map((m, i) => `${i + 1}. ${m}`)),
      ...sub('Definition of done', items(delivery.definitionOfDone).map((d) => `- [ ] ${d}`)),
      ...sub('Open questions', bullets(delivery.openQuestions)),
    ]),
  );

  // Sections and subsections each pad themselves with blank lines; collapse the doubles.
  return out.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
}
