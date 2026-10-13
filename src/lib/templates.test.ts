import { describe, expect, it } from 'vitest';
import { generateMarkdown } from './markdown';
import { lintSpec } from './lint';
import { emptyEntity, emptyFeature, emptySpec, type Spec } from './spec';
import {
  BUILT_IN_TEMPLATES,
  FileFormatError,
  parseTemplateFile,
  serializeTemplate,
  templateFileName,
  DEFAULT_SECTIONS,
  createTemplate,
  extractTemplateSpec,
  normalizeTemplate,
  specFromTemplate,
} from './templates';

function full(): Spec {
  const s = emptySpec();
  s.target = 'claude';
  s.overview = { name: 'Recipe Box', tagline: 'Recipes', projectType: 'cli', stage: 'existing', summary: 'Sum' };
  s.problem.nonGoals = ['No sharing'];
  s.features = [{ ...emptyFeature(), title: 'Import' }];
  s.userFlows = ['Paste URL'];
  s.tech.languages = 'Go';
  s.architecture.entities = [{ ...emptyEntity(), name: 'Recipe' }];
  s.quality.testing = 'go test';
  s.agent.rules = ['Run tests'];
  s.delivery = { milestones: ['M1'], definitionOfDone: ['Tests pass'], openQuestions: ['Sync?'] };
  return s;
}

describe('extractTemplateSpec', () => {
  it('keeps only the chosen sections plus type, stage and target', () => {
    const t = extractTemplateSpec(full(), DEFAULT_SECTIONS);
    expect(t.target).toBe('claude');
    expect(t.overview).toMatchObject({ name: '', tagline: '', summary: '', projectType: 'cli', stage: 'existing' });
    expect(t.tech.languages).toBe('Go');
    expect(t.quality.testing).toBe('go test');
    expect(t.agent.rules).toEqual(['Run tests']);
    expect(t.delivery).toEqual({ milestones: ['M1'], definitionOfDone: ['Tests pass'], openQuestions: [] });
    expect(t.problem.nonGoals).toEqual([]);
    expect(t.features).toEqual([]);
    expect(t.userFlows).toEqual([]);
    expect(t.architecture.entities).toEqual([]);
  });

  it('includes project-specific sections when asked', () => {
    const t = extractTemplateSpec(full(), ['features', 'problem', 'architecture']);
    expect(t.features.map((f) => f.title)).toEqual(['Import']);
    expect(t.userFlows).toEqual(['Paste URL']);
    expect(t.problem.nonGoals).toEqual(['No sharing']);
    expect(t.tech.languages).toBe('');
  });

  it('does not share references with the source spec', () => {
    const src = full();
    const t = extractTemplateSpec(src, ['agent']);
    t.agent.rules.push('x');
    expect(src.agent.rules).toEqual(['Run tests']);
  });
});

describe('specFromTemplate', () => {
  it('creates a fresh draft with new ids', () => {
    const tpl = createTemplate(full(), ' Go CLI ', '', ['features', 'architecture', 'tech']);
    expect(tpl.name).toBe('Go CLI');
    const a = specFromTemplate(tpl);
    const b = specFromTemplate(tpl);
    expect(a.id).not.toBe(b.id);
    expect(a.id).not.toBe(tpl.spec.id);
    expect(a.features[0].id).not.toBe(tpl.spec.features[0].id);
    expect(a.architecture.entities[0].id).not.toBe(tpl.spec.architecture.entities[0].id);
    expect(a.overview.name).toBe('');
    expect(a.tech.languages).toBe('Go');
    a.features[0].title = 'changed';
    expect(tpl.spec.features[0].title).toBe('Import');
  });
});

describe('normalizeTemplate', () => {
  it('rejects junk and fills missing fields', () => {
    expect(normalizeTemplate(null)).toBeNull();
    expect(normalizeTemplate({ id: 'x', name: '  ' })).toBeNull();
    const t = normalizeTemplate({ id: 'x', name: 'Mine', sections: ['tech', 'bogus'], spec: { tech: { languages: 'Rust' } } });
    expect(t?.sections).toEqual(['tech']);
    expect(t?.spec.tech.languages).toBe('Rust');
    expect(t?.spec.agent.commands.test).toBe('');
  });
});

describe('BUILT_IN_TEMPLATES', () => {
  it('have unique ids and produce valid specs with stack, rules and a test command', () => {
    expect(new Set(BUILT_IN_TEMPLATES.map((t) => t.id)).size).toBe(BUILT_IN_TEMPLATES.length);
    for (const t of BUILT_IN_TEMPLATES) {
      const s = specFromTemplate(t);
      expect(s.tech.languages, t.name).not.toBe('');
      expect(s.agent.commands.test, t.name).not.toBe('');
      expect(s.agent.rules.length, t.name).toBeGreaterThan(0);
      expect(s.delivery.definitionOfDone.length, t.name).toBeGreaterThan(0);
      // A starter should only leave project-specific gaps, not stack/testing ones.
      const steps = new Set(lintSpec(s).filter((i) => i.severity !== 'tip').map((i) => i.step));
      expect(steps.has('tech'), t.name).toBe(false);
      expect(steps.has('quality'), t.name).toBe(false);
      expect(generateMarkdown(s)).toContain('## Tech stack');
    }
  });
});

describe('template files', () => {
  const tpl = () => createTemplate(full(), 'Go CLI: v2!', 'Mine', ['tech', 'agent']);

  it('round-trips through export and import with a new id', () => {
    const t = tpl();
    const back = parseTemplateFile(serializeTemplate(t));
    expect(back.id).not.toBe(t.id);
    expect(back.spec.id).not.toBe(t.spec.id);
    expect(back).toMatchObject({ name: 'Go CLI: v2!', description: 'Mine', sections: ['tech', 'agent'] });
    expect(back.spec.tech.languages).toBe('Go');
    expect(back.spec.agent.rules).toEqual(['Run tests']);
    expect(back.builtIn).toBeUndefined();
  });

  it('does not export the built-in flag, so a shared starter imports as a normal template', () => {
    const text = serializeTemplate(BUILT_IN_TEMPLATES[0]);
    expect(text).not.toContain('builtIn');
    expect(parseTemplateFile(text).builtIn).toBeUndefined();
  });

  it('renames on a name clash, case-insensitively', () => {
    expect(parseTemplateFile(serializeTemplate(tpl()), ['go cli: V2!']).name).toBe('Go CLI: v2! (imported)');
  });

  it('rejects non-JSON, spec drafts and damaged templates with a readable error', () => {
    expect(() => parseTemplateFile('nope')).toThrow(FileFormatError);
    expect(() => parseTemplateFile(JSON.stringify(full()))).toThrow(/not a Prompt Organizer template/);
    expect(() => parseTemplateFile(JSON.stringify({ kind: 'prompt-organizer-template', template: {} }))).toThrow(
      /incomplete or damaged/,
    );
  });

  it('builds a safe file name', () => {
    expect(templateFileName(tpl())).toBe('go-cli-v2.template.json');
  });
});
