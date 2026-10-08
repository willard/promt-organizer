import { describe, expect, it } from 'vitest';
import { REVIEW_SCHEMA, applySuggestion, buildReviewPrompt, canApply, parseReview, type Suggestion } from './ai';
import { emptyFeature, emptySpec, type Spec } from './spec';

function spec(): Spec {
  const s = emptySpec();
  s.overview.name = 'Recipe Box';
  s.features = [{ ...emptyFeature(), title: 'Import from URL', acceptance: ['Saves ingredients', ''] }];
  return s;
}

const sug = (over: Partial<Suggestion>): Suggestion => ({
  id: 'x',
  kind: 'goal',
  target: '',
  text: 'Something',
  reason: '',
  ...over,
});

describe('buildReviewPrompt', () => {
  it('includes the rendered spec and exact feature titles', () => {
    const p = buildReviewPrompt(spec());
    expect(p).toContain('"Import from URL"');
    expect(p).toContain('<spec>\n# Recipe Box');
  });
});

describe('REVIEW_SCHEMA', () => {
  it('is a strict schema with every property required', () => {
    const item = REVIEW_SCHEMA.properties.suggestions.items;
    expect(item.additionalProperties).toBe(false);
    expect([...item.required].sort()).toEqual(Object.keys(item.properties).sort());
  });
});

describe('parseReview', () => {
  it('keeps valid suggestions and drops malformed ones', () => {
    const r = parseReview(
      JSON.stringify({
        summary: ' Mostly good. ',
        suggestions: [
          { kind: 'acceptance', target: 'Import from URL', text: '- Invalid URL shows an error', reason: 'Failure path' },
          { kind: 'bogus', target: '', text: 'x', reason: '' },
          { kind: 'goal', target: '', text: '   ', reason: '' },
          { kind: 'milestone', target: '', text: '1. Ship v1', reason: '' },
          { kind: 'goal', target: '', text: '5 second search', reason: '' },
          null,
        ],
      }),
    );
    expect(r.summary).toBe('Mostly good.');
    expect(r.suggestions.map((s) => [s.kind, s.text])).toEqual([
      ['acceptance', 'Invalid URL shows an error'],
      ['milestone', 'Ship v1'],
      ['goal', '5 second search'],
    ]);
    expect(new Set(r.suggestions.map((s) => s.id)).size).toBe(3);
  });

  it('throws on non-JSON', () => {
    expect(() => parseReview('not json')).toThrow();
  });
});

describe('applySuggestion', () => {
  it('adds acceptance criteria to the matching feature, case-insensitively, reusing blank rows', () => {
    const s = spec();
    expect(applySuggestion(s, sug({ kind: 'acceptance', target: 'import from url', text: 'Rejects bad URLs' }))).toBe(true);
    expect(s.features[0].acceptance).toEqual(['Saves ingredients', 'Rejects bad URLs']);
  });

  it('does not duplicate existing items', () => {
    const s = spec();
    applySuggestion(s, sug({ kind: 'acceptance', target: 'Import from URL', text: 'saves ingredients' }));
    expect(s.features[0].acceptance).toEqual(['Saves ingredients', '']);
  });

  it('refuses acceptance criteria for unknown features', () => {
    const s = spec();
    const x = sug({ kind: 'acceptance', target: 'Nope', text: 'y' });
    expect(canApply(s, x)).toBe(false);
    expect(applySuggestion(s, x)).toBe(false);
  });

  it('routes each kind to its list, and issues to open questions', () => {
    const s = spec();
    applySuggestion(s, sug({ kind: 'nonGoal', text: 'No sharing' }));
    applySuggestion(s, sug({ kind: 'forbidden', text: 'Commit secrets' }));
    applySuggestion(s, sug({ kind: 'definitionOfDone', text: 'Tests pass' }));
    applySuggestion(s, sug({ kind: 'issue', text: 'Single user or multi-user?' }));
    expect(s.problem.nonGoals).toEqual(['No sharing']);
    expect(s.agent.forbidden).toEqual(['Commit secrets']);
    expect(s.delivery.definitionOfDone).toEqual(['Tests pass']);
    expect(s.delivery.openQuestions).toEqual(['Single user or multi-user?']);
  });
});
