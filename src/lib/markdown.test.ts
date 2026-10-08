import { describe, expect, it } from 'vitest';
import { generateMarkdown } from './markdown';
import { completeness, findVagueWords, lintSpec } from './lint';
import { emptyFeature, emptySpec, normalizeSpec, type Spec } from './spec';

function sample(): Spec {
  const s = emptySpec();
  s.overview.name = 'Recipe Box';
  s.overview.tagline = 'Save recipes from any URL.';
  s.overview.summary = 'A personal recipe manager.';
  s.problem.goals = ['Find a recipe in under 5 seconds', ''];
  s.features = [
    { ...emptyFeature(), title: 'Import from URL', priority: 'must', acceptance: ['Ingredients saved as a list'] },
    { ...emptyFeature(), title: 'Dark mode', priority: 'could' },
    { ...emptyFeature(), title: '   ' },
  ];
  s.tech.languages = 'TypeScript';
  s.agent.commands.test = 'npm test';
  s.agent.structure = 'src/\n  lib/';
  return s;
}

describe('generateMarkdown', () => {
  it('renders title, tagline and populated sections', () => {
    const md = generateMarkdown(sample());
    expect(md).toMatch(/^# Recipe Box\n\n> Save recipes from any URL\./);
    expect(md).toContain('## Features');
    expect(md).toContain('### Must have\n\n#### Import from URL');
    expect(md).toContain('- [ ] Ingredients saved as a list');
    expect(md).toContain('### Nice to have\n\n#### Dark mode');
    expect(md).toContain('- **Languages:** TypeScript');
    expect(md).toContain('- Test: `npm test`');
    expect(md).toContain('```\nsrc/\n  lib/\n```');
  });

  it('skips empty sections, blank list items and untitled features', () => {
    const md = generateMarkdown(sample());
    expect(md).not.toContain('## Quality requirements');
    expect(md).not.toContain('## Key user flows');
    expect(md).not.toContain('### Should have');
    expect(md).not.toMatch(/^- $/m);
    expect(md).not.toMatch(/\n\n\n/);
    expect(md.endsWith('\n')).toBe(true);
  });

  it('changes the intro per output target', () => {
    const s = sample();
    expect(generateMarkdown(s)).toContain('You are an expert software engineer');
    s.target = 'claude';
    expect(generateMarkdown(s)).toContain('Claude Code');
    s.target = 'agents';
    expect(generateMarkdown(s)).toContain('AI coding agents');
  });

  it('handles a completely empty spec', () => {
    const md = generateMarkdown(emptySpec());
    expect(md).toContain('# Untitled project');
    expect(md).toContain('## Working agreement for the AI agent');
  });
});

describe('lintSpec', () => {
  it('flags missing name and features on an empty spec', () => {
    const issues = lintSpec(emptySpec());
    expect(issues.filter((i) => i.severity === 'error').map((i) => i.step)).toEqual(['overview', 'features']);
  });

  it('flags features without acceptance criteria', () => {
    const issues = lintSpec(sample());
    expect(issues.some((i) => i.message.includes('"Dark mode" has no acceptance criteria'))).toBe(true);
    expect(issues.some((i) => i.message.includes('Import from URL'))).toBe(false);
  });

  it('finds vague words', () => {
    expect(findVagueWords('It should be fast, Simple and user-friendly etc.')).toEqual([
      'fast',
      'simple',
      'user-friendly',
      'etc',
    ]);
    expect(findVagueWords('Fasten the breakfast')).toEqual([]);
  });
});

describe('completeness', () => {
  it('goes from 0 toward 100 as fields are filled', () => {
    expect(completeness(emptySpec())).toBe(0);
    expect(completeness(sample())).toBeGreaterThan(20);
  });
});

describe('normalizeSpec', () => {
  it('fills missing fields from partial drafts', () => {
    const s = normalizeSpec({ overview: { name: 'Old' }, agent: { commands: { test: 'pytest' } } });
    expect(s.overview.name).toBe('Old');
    expect(s.overview.projectType).toBe('web');
    expect(s.agent.commands.test).toBe('pytest');
    expect(s.agent.commands.build).toBe('');
    expect(s.delivery.milestones).toEqual([]);
  });
});
