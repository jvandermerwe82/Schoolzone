import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { afterAnswerLine, lessonStatusFor } from '../brain-view/lesson-status';
import { seededRng } from '../brain-lab/rng';
import type { Question } from '../brain/types';
import { fractionBarsFor } from '../content/fraction-bars';
import { MATHS_Y6_GENERATORS } from '../content/maths-y6';
import { AnimatedMathSupport } from './AnimatedMathSupport';
import { FractionBars } from './FractionBars';
import { LessonStatus } from './LessonStatus';

const l2 = (seed: number): Question => MATHS_Y6_GENERATORS['fractions-y6'](2, seededRng(seed));
const SEEDS = Array.from({ length: 60 }, (_, i) => i + 1);
const count = (html: string, needle: string) => html.split(needle).length - 1;

describe('fraction bars markup', () => {
  it('draws exactly the right number of equal pieces and labels each bar for screen readers', () => {
    for (const seed of SEEDS) {
      const question = l2(seed);
      const model = fractionBarsFor(question)!;
      const html = renderToStaticMarkup(<FractionBars question={question} mode="hint" />);
      expect(count(html, 'class="fb-piece'), question.prompt).toBe(model.parts[0].denominator + model.parts[1].denominator);
      expect(count(html, 'role="img"')).toBe(2);
      expect(html).toContain('equal pieces shaded');
    }
  });

  it('starts hint mode with different-size pieces and never shows the combined total', () => {
    for (const seed of SEEDS) {
      const question = l2(seed);
      const html = renderToStaticMarkup(<FractionBars question={question} mode="hint" />);
      expect(html).not.toContain('fb-total');
      const model = fractionBarsFor(question)!;
      if (model.parts[0].denominator !== model.parts[1].denominator) {
        expect(html).toContain('cannot be counted together yet');
      }
    }
  });

  it('shows the matched bars and the working in worked mode only', () => {
    for (const seed of SEEDS) {
      const question = l2(seed);
      const html = renderToStaticMarkup(<FractionBars question={question} mode="worked" />);
      expect(html).toContain('fb-total');
      expect(html).toContain('Both bars use pieces of the same size');
    }
  });

  it('keeps controls at least 44px and names every control', () => {
    const html = renderToStaticMarkup(<FractionBars question={l2(3)} mode="hint" />);
    expect(html).toMatch(/aria-label="Cut each piece of the first bar into 2 equal pieces"/);
    expect(html).toMatch(/aria-pressed="true"/);
    expect(html).not.toContain('—');
  });

  it('is the visual guide for addition it can draw exactly, and the static visual otherwise', () => {
    const supported = renderToStaticMarkup(<AnimatedMathSupport question={l2(4)} mode="hint" />);
    expect(supported).toContain('class="fraction-bars"');
    const other: Question = { ...l2(4), prompt: 'What is 3/4 of 20?', answer: '15' };
    const fallback = renderToStaticMarkup(<AnimatedMathSupport question={other} mode="worked" />);
    expect(fallback).not.toContain('class="fraction-bars"');
    expect(fallback).toContain('as-fractions');
  });
});

describe('lesson status', () => {
  const base = { helped: false, msSincePreviousAttempt: 1_000 };

  it('shows a three-step ribbon while helping and while climbing back up', () => {
    const helping = lessonStatusFor({ ...base, plan: { reason: 'help', strategy: 'worked-example' }, helped: true });
    expect(helping.ribbon?.map((s) => s.state)).toEqual(['done', 'now', 'next']);
    expect(helping.mode.mode).toBe('assisted-practice');
    const climbing = lessonStatusFor({ ...base, plan: { reason: 'climb', strategy: 'climb' } });
    expect(climbing.ribbon?.map((s) => s.state)).toEqual(['done', 'done', 'now']);
    expect(climbing.mode.mode).toBe('unaided-demonstration');
    expect(lessonStatusFor({ ...base, plan: { reason: 'continue' } }).ribbon).toBeNull();
  });

  it('renders accessible markup with the current step marked', () => {
    const html = renderToStaticMarkup(
      <LessonStatus status={lessonStatusFor({ ...base, plan: { reason: 'help', strategy: 'similar' } })} />,
    );
    expect(html).toContain('aria-label="How SchoolZone is helping"');
    expect(html).toContain('aria-current="step"');
    expect(html).toContain('Practice with help');
  });

  it('never calls a helped answer independent in the after-answer line', () => {
    const helped = lessonStatusFor({ ...base, plan: { reason: 'help', strategy: 'hint' }, helped: true }).mode;
    expect(afterAnswerLine(helped, true)).toMatch(/had help/);
    expect(afterAnswerLine(helped, true)).not.toMatch(/all you/i);
  });

  it('uses plain Australian English with no em dashes anywhere', () => {
    const lines: string[] = [];
    for (const reason of ['help', 'climb', 'continue', 'review'] as const) {
      for (const strategy of [undefined, 'similar', 'worked-example', 'hint', 'smaller-steps', 'prerequisite', 'climb'] as const) {
        const view = lessonStatusFor({ ...base, plan: { reason, strategy } });
        lines.push(view.mode.childLabel, view.mode.explanation, view.helpLine ?? '', ...(view.ribbon?.map((r) => r.label) ?? []));
        lines.push(afterAnswerLine(view.mode, true), afterAnswerLine(view.mode, false));
      }
    }
    for (const line of lines) expect(line).not.toContain('—');
  });
});
