import { useEffect, useMemo, useState } from 'react';
import type { Question } from '../brain/types';
import { animatedSupportFor, type AnimatedSupport } from '../content/animated-support';

interface Props {
  question: Question;
  mode: 'hint' | 'worked';
}

const minus = (value: string) => value.replace(/^-/, '−');

function reducedMotion(): boolean {
  if (typeof window === 'undefined') return true;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
    || document.documentElement.classList.contains('calm');
}

function PlaceValueVisual({
  support,
  step,
}: {
  support: Extract<AnimatedSupport, { kind: 'place-value' }>;
  step: number;
}) {
  return (
    <div className="as-place-grid" aria-label="Place value columns">
      {support.digits.map((digit, index) => {
        const place = support.places[index];
        const target = support.targetPlace === place && step >= 1;
        return (
          <div className={`as-place ${target ? 'active' : ''}`} key={`${place}-${index}`}>
            <span className="as-digit">{digit}</span>
            <small>{place.replace('-', ' ')}</small>
          </div>
        );
      })}
    </div>
  );
}

function ColumnVisual({
  support,
  step,
}: {
  support: Extract<AnimatedSupport, { kind: 'column' }>;
  step: number;
}) {
  const width = Math.max(support.top.length, support.bottom.length);
  const top = support.top.padStart(width, ' ').split('');
  const bottom = support.bottom.padStart(width, ' ').split('');
  const highlightOnes = step >= 1;
  return (
    <div className="as-column" aria-label={support.operation === '+' ? 'Column addition' : 'Column subtraction'}>
      {support.regroup && step >= 2 && (
        <div className="as-regroup" role="note">
          {support.operation === '+' ? '↖ carry 1 ten' : '↘ exchange 1 ten → 10 ones'}
        </div>
      )}
      <div className="as-column-row">
        <span className="as-operation" aria-hidden="true">&nbsp;</span>
        {top.map((digit, index) => (
          <span key={index} className={highlightOnes && index === width - 1 ? 'active' : ''}>{digit || ' '}</span>
        ))}
      </div>
      <div className="as-column-row">
        <span className="as-operation">{support.operation}</span>
        {bottom.map((digit, index) => (
          <span key={index} className={highlightOnes && index === width - 1 ? 'active' : ''}>{digit || ' '}</span>
        ))}
      </div>
      <div className="as-column-line" />
    </div>
  );
}

function FractionCard({
  numerator,
  denominator,
  active,
}: {
  numerator: number;
  denominator: number;
  active: boolean;
}) {
  const pieces = Math.min(denominator, 12);
  return (
    <div className={`as-fraction-card ${active ? 'active' : ''}`}>
      <div className="as-fraction-number" aria-label={`${numerator} over ${denominator}`}>
        <span>{numerator}</span>
        <span>{denominator}</span>
      </div>
      <div className="as-fraction-bar" aria-hidden="true">
        {Array.from({ length: pieces }, (_, index) => (
          <span key={index} className={index < Math.min(numerator, pieces) ? 'filled' : ''} />
        ))}
      </div>
    </div>
  );
}

function FractionVisual({
  support,
  step,
}: {
  support: Extract<AnimatedSupport, { kind: 'fraction' }>;
  step: number;
}) {
  const symbol = support.operation === 'of'
    ? 'of'
    : support.operation === 'compare'
      ? '↔'
      : support.operation === 'simplify'
        ? '→ simplest'
        : support.operation;

  return (
    <div className="as-fractions" aria-label="Fraction visual">
      {support.fractions.map((f, index) => (
        <div className="as-fraction-wrap" key={`${f.numerator}/${f.denominator}-${index}`}>
          <FractionCard {...f} active={step >= 0} />
          {index < support.fractions.length - 1 && <span className="as-symbol">{symbol}</span>}
        </div>
      ))}
      {support.amount !== undefined && (
        <>
          <span className="as-symbol">of</span>
          <span className="as-amount">{support.amount}</span>
        </>
      )}
    </div>
  );
}

function GroupsVisual({
  support,
  step,
}: {
  support: Extract<AnimatedSupport, { kind: 'groups' }>;
  step: number;
}) {
  if (support.operation === 'divide') {
    return (
      <div className="as-groups as-division" aria-label="Division into equal groups">
        <span className="as-amount">{support.left}</span>
        <span className="as-symbol">÷</span>
        <span className={step >= 1 ? 'as-group-size active' : 'as-group-size'}>{support.right} per group</span>
        <span className="as-symbol">→</span>
        <span className="as-question-mark">?</span>
      </div>
    );
  }

  const groups = Math.min(support.right, 6);
  return (
    <div className="as-groups" aria-label="Equal multiplication groups">
      <div className="as-group-row">
        {Array.from({ length: groups }, (_, index) => (
          <span className={step >= 1 ? 'as-group-chip active' : 'as-group-chip'} key={index}>
            {support.left}
          </span>
        ))}
        {support.right > groups && <span className="as-more">… × {support.right} groups</span>}
      </div>
      <div className="as-equation">{support.left} × {support.right}</div>
    </div>
  );
}

function SupportVisual({
  support,
  step,
  mode,
}: {
  support: AnimatedSupport;
  step: number;
  mode: 'hint' | 'worked';
}) {
  switch (support.kind) {
    case 'place-value':
      if (mode === 'hint') {
        return (
          <div className="as-place-guide" aria-label="Place value order">
            {['thousands', 'hundreds', 'tens', 'ones'].map((place) => (
              <span key={place}>{place}</span>
            ))}
          </div>
        );
      }
      return <PlaceValueVisual support={support} step={step} />;
    case 'column':
      return <ColumnVisual support={support} step={step} />;
    case 'fraction':
      return <FractionVisual support={support} step={step} />;
    case 'groups':
      return <GroupsVisual support={support} step={step} />;
  }
}

export function AnimatedMathSupport({ question, mode }: Props) {
  const support = useMemo(() => animatedSupportFor(question), [question]);
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    setStep(0);
    setPlaying(!!support && support.steps.length > 1 && !reducedMotion());
  }, [question.id, mode, support?.kind, support?.steps.length]);

  useEffect(() => {
    if (!support || !playing || reducedMotion()) return;
    if (step >= support.steps.length - 1) {
      setPlaying(false);
      return;
    }
    const timer = window.setTimeout(() => setStep((value) => value + 1), 1100);
    return () => window.clearTimeout(timer);
  }, [support, step, playing]);

  if (!support) return null;
  // A comparison bar can make a multiple-choice fraction answer visually obvious.
  // Keep it for worked examples, but not for answer-safe hint mode.
  if (mode === 'hint' && support.kind === 'fraction' && support.operation === 'compare') return null;

  const current = support.steps[Math.min(step, support.steps.length - 1)];
  const finished = step >= support.steps.length - 1;

  return (
    <section className={`animated-support ${mode}`} aria-label={mode === 'hint' ? 'Animated visual hint' : 'Animated worked example'}>
      <div className="as-head">
        <div>
          <strong>{mode === 'hint' ? '✨ Visual hint' : '✨ Animated example'}</strong>
          <small>{support.title}</small>
        </div>
        <button
          type="button"
          className="as-replay"
          onClick={() => {
            setStep(0);
            setPlaying(!reducedMotion() && support.steps.length > 1);
          }}
        >
          ↻ Replay
        </button>
      </div>

      <SupportVisual support={support} step={step} mode={mode} />

      <div className="as-step" aria-live="polite">
        <span className="as-step-count">Step {step + 1}/{support.steps.length}</span>
        <strong>{current.title}</strong>
        <p>{current.text}</p>
      </div>

      <div className="as-dots" aria-hidden="true">
        {support.steps.map((_, index) => (
          <span key={index} className={index <= step ? 'on' : ''} />
        ))}
      </div>

      {mode === 'worked' && finished && (
        <p className="as-answer"><strong>Answer:</strong> {minus(question.answer)}</p>
      )}
    </section>
  );
}
