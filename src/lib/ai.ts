import { generateMarkdown } from './markdown';
import type { Spec } from './spec';

export type SuggestionKind =
  | 'acceptance'
  | 'goal'
  | 'nonGoal'
  | 'userFlow'
  | 'rule'
  | 'forbidden'
  | 'milestone'
  | 'definitionOfDone'
  | 'openQuestion'
  | 'issue';

export interface Suggestion {
  id: string;
  kind: SuggestionKind;
  /** Exact feature title for `acceptance`; empty otherwise. */
  target: string;
  text: string;
  reason: string;
}

export interface Review {
  summary: string;
  suggestions: Suggestion[];
}

export const KIND_LABEL: Record<SuggestionKind, string> = {
  acceptance: 'Acceptance criterion',
  goal: 'Goal',
  nonGoal: 'Non-goal',
  userFlow: 'User flow',
  rule: 'Agent rule (always)',
  forbidden: 'Agent rule (never)',
  milestone: 'Milestone',
  definitionOfDone: 'Definition of done',
  openQuestion: 'Open question',
  issue: 'Contradiction / ambiguity',
};

/** Wizard step each suggestion kind belongs to, so the UI can link to it. */
export const KIND_STEP: Record<SuggestionKind, string> = {
  acceptance: 'features',
  goal: 'problem',
  nonGoal: 'problem',
  userFlow: 'features',
  rule: 'agent',
  forbidden: 'agent',
  milestone: 'delivery',
  definitionOfDone: 'delivery',
  openQuestion: 'delivery',
  issue: 'delivery',
};

const KINDS = Object.keys(KIND_LABEL) as SuggestionKind[];

export const REVIEW_SYSTEM = `You review software project specs that a developer will hand to an AI coding agent. Your goal is to catch what would make the agent build the wrong thing, and propose concrete additions the developer can accept with one click.

What to look for, most important first:
- Features with missing, vague or untestable acceptance criteria. Good criteria are observable and checkable ("Given X, when Y, then Z"), and cover edge cases and failure paths (empty input, invalid data, network errors, permissions), not just the happy path.
- Contradictions between sections (e.g. a non-goal that a feature depends on, a stack that cannot do what a feature needs, a performance target that conflicts with the architecture).
- Decisions the agent would otherwise have to guess that are hard to reverse: auth, data ownership, persistence, deployment target, migrations.
- Missing non-goals that would stop obvious scope creep, missing milestones or definition-of-done checks, and agent rules that fit this specific stack.

Rules:
- Be specific to this project. No generic advice that would apply to any app.
- Do not repeat anything the spec already says.
- Prefer fewer, high-impact suggestions; return at most 15.
- Each "text" must be ready to paste into the spec as-is: one line, no leading bullet or numbering.
- For kind "acceptance", "target" must be the exact title of an existing feature. For every other kind, "target" is "".
- Use kind "issue" for contradictions or ambiguities only the developer can resolve; phrase "text" as a question they need to answer.
- "reason" is one short sentence on why it matters.
- "summary" is two sentences at most: the overall state of the spec and the single biggest risk.`;

export const REVIEW_SCHEMA = {
  type: 'object',
  properties: {
    summary: { type: 'string' },
    suggestions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          kind: { type: 'string', enum: KINDS },
          target: { type: 'string' },
          text: { type: 'string' },
          reason: { type: 'string' },
        },
        required: ['kind', 'target', 'text', 'reason'],
        additionalProperties: false,
      },
    },
  },
  required: ['summary', 'suggestions'],
  additionalProperties: false,
} as const;

export function buildReviewPrompt(spec: Spec): string {
  const titles = spec.features.map((f) => f.title.trim()).filter(Boolean);
  return [
    'Review this spec and return suggestions.',
    '',
    `Existing feature titles (use these exactly as "target" for acceptance criteria): ${
      titles.length ? titles.map((t) => JSON.stringify(t)).join(', ') : '(none yet)'
    }`,
    '',
    '<spec>',
    generateMarkdown(spec),
    '</spec>',
  ].join('\n');
}

let seq = 0;

/** Validate the model's JSON and drop anything malformed rather than trusting it blindly. */
export function parseReview(text: string): Review {
  const raw = JSON.parse(text) as { summary?: unknown; suggestions?: unknown };
  const list = Array.isArray(raw.suggestions) ? raw.suggestions : [];
  const suggestions: Suggestion[] = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const s = item as Record<string, unknown>;
    if (!KINDS.includes(s.kind as SuggestionKind)) continue;
    const textValue = typeof s.text === 'string' ? s.text.trim().replace(/^(?:[-*•]\s+|\d+[.)]\s+)/, '') : '';
    if (!textValue) continue;
    suggestions.push({
      id: `sug-${Date.now().toString(36)}-${seq++}`,
      kind: s.kind as SuggestionKind,
      target: typeof s.target === 'string' ? s.target.trim() : '',
      text: textValue,
      reason: typeof s.reason === 'string' ? s.reason.trim() : '',
    });
  }
  return { summary: typeof raw.summary === 'string' ? raw.summary.trim() : '', suggestions };
}

const norm = (s: string) => s.trim().toLowerCase();

export function findFeatureIndex(spec: Spec, title: string): number {
  return spec.features.findIndex((f) => f.title.trim() && norm(f.title) === norm(title));
}

/** Whether a suggestion can be applied to the current spec (acceptance criteria need their feature to exist). */
export function canApply(spec: Spec, s: Suggestion): boolean {
  return s.kind !== 'acceptance' || findFeatureIndex(spec, s.target) >= 0;
}

function pushUnique(list: string[], text: string) {
  if (!list.some((i) => norm(i) === norm(text))) {
    // Reuse a trailing empty row left over from the form instead of adding after it.
    const blank = list.findIndex((i) => !i.trim());
    if (blank >= 0) list[blank] = text;
    else list.push(text);
  }
}

/** Mutates `draft` to include the suggestion. Returns false if it could not be applied. */
export function applySuggestion(draft: Spec, s: Suggestion): boolean {
  switch (s.kind) {
    case 'acceptance': {
      const i = findFeatureIndex(draft, s.target);
      if (i < 0) return false;
      pushUnique(draft.features[i].acceptance, s.text);
      return true;
    }
    case 'goal':
      pushUnique(draft.problem.goals, s.text);
      return true;
    case 'nonGoal':
      pushUnique(draft.problem.nonGoals, s.text);
      return true;
    case 'userFlow':
      pushUnique(draft.userFlows, s.text);
      return true;
    case 'rule':
      pushUnique(draft.agent.rules, s.text);
      return true;
    case 'forbidden':
      pushUnique(draft.agent.forbidden, s.text);
      return true;
    case 'milestone':
      pushUnique(draft.delivery.milestones, s.text);
      return true;
    case 'definitionOfDone':
      pushUnique(draft.delivery.definitionOfDone, s.text);
      return true;
    case 'openQuestion':
    case 'issue':
      // Contradictions need a human decision; record them so the agent asks instead of guessing.
      pushUnique(draft.delivery.openQuestions, s.text);
      return true;
  }
}

export type ReviewResult = { ok: true; review: Review } | { ok: false; error: string };

/** Ask Claude (through the Electron main process) to review the spec. */
export async function requestReview(spec: Spec): Promise<ReviewResult> {
  if (!window.api) return { ok: false, error: 'AI review is only available in the desktop app.' };
  const res = await window.api.aiComplete({
    system: REVIEW_SYSTEM,
    prompt: buildReviewPrompt(spec),
    schema: REVIEW_SCHEMA,
  });
  if (!res.ok) return res;
  try {
    return { ok: true, review: parseReview(res.text) };
  } catch {
    return { ok: false, error: 'Claude returned a response that could not be read. Try again.' };
  }
}
