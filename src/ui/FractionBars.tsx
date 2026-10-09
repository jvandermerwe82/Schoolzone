import { useMemo, useState } from 'react';
import type { Question } from '../brain/types';
import {
  combinedPart, describeBar, fractionBarsFor, barPieces, sameSizePieces, splitOptions, splitPart,
  type FractionPart,
} from '../content/fraction-bars';
import './fraction-bars.css';

interface Props {
  question: Question;
  /** hint never shows the combined total, because that is the answer. worked does. */
  mode: 'hint' | 'worked';
}

const label = (p: FractionPart) => `${p.numerator}/${p.denominator}`;

function Bar({ part, k, tone, name }: { part: FractionPart; k: number; tone: 'a' | 'b' | 'total'; name: string }) {
  const cut = splitPart(part, k);
  const pieces = barPieces(cut.denominator, cut.numerator);
  return (
    <div
      className={`fb-bar fb-${tone}`}
      role="img"
      aria-label={`${name}: ${describeBar(part, k)}`}
    >
      {pieces.map((piece) => (
        <span
          key={piece.index}
          className={`fb-piece${piece.shaded ? ' on' : ''}${k > 1 && piece.index % k === 0 && piece.index > 0 ? ' edge' : ''}`}
          style={{ flexBasis: `${piece.width * 100}%` }}
        />
      ))}
    </div>
  );
}

/**
 * Interactive fraction bars. The child cuts each bar into equal smaller pieces
 * and sees why pieces of different sizes cannot be counted together. This is a
 * visual support only: the typed answer is still how the question is answered.
 */
export function FractionBars({ question, mode }: Props) {
  const model = useMemo(() => fractionBarsFor(question), [question]);
  const [splits, setSplits] = useState<readonly [number, number]>(
    () => (mode === 'worked' && model ? model.matchingSplits : [1, 1]),
  );
  if (!model) return null;

  const left = splitPart(model.parts[0], splits[0]);
  const right = splitPart(model.parts[1], splits[1]);
  const matched = sameSizePieces(left, right);
  const total = mode === 'worked' ? combinedPart(model, splits) : null;
  const verb = model.operation === '+' ? 'add' : 'take away';

  const status = matched
    ? mode === 'worked' && total
      ? `Both bars use pieces of the same size, so we can ${verb}: ${label(left)} ${model.operation} ${label(right)} = ${label(total)}.`
      : `Both bars use pieces of the same size (each is 1/${left.denominator} of the whole). Now you can count the shaded pieces and ${verb}.`
    : `The pieces are different sizes (1/${left.denominator} and 1/${right.denominator}), so they cannot be counted together yet. Cut the pieces until both bars match.`;

  const control = (index: 0 | 1, name: string) => {
    const part = model.parts[index];
    return (
      <div className="fb-cut" role="group" aria-label={`Cut each piece of the ${name} bar into equal smaller pieces`}>
        <span className="fb-cut-label">Cut each piece into</span>
        {splitOptions(part).map((k) => (
          <button
            key={k}
            type="button"
            className={splits[index] === k ? 'fb-k on' : 'fb-k'}
            aria-pressed={splits[index] === k}
            aria-label={k === 1 ? `Keep the ${name} bar as it is` : `Cut each piece of the ${name} bar into ${k} equal pieces`}
            onClick={() => setSplits(index === 0 ? [k, splits[1]] : [splits[0], k])}
          >
            {k}
          </button>
        ))}
      </div>
    );
  };

  return (
    <section className="fraction-bars" aria-label="Fraction bars">
      <div className="fb-row">
        <div className="fb-name">
          <strong>{label(model.parts[0])}</strong>
          {splits[0] > 1 && <small>= {label(left)}</small>}
        </div>
        <Bar part={model.parts[0]} k={splits[0]} tone="a" name="First bar" />
      </div>
      {control(0, 'first')}

      <div className="fb-op" aria-hidden="true">{model.operation}</div>

      <div className="fb-row">
        <div className="fb-name">
          <strong>{label(model.parts[1])}</strong>
          {splits[1] > 1 && <small>= {label(right)}</small>}
        </div>
        <Bar part={model.parts[1]} k={splits[1]} tone="b" name="Second bar" />
      </div>
      {control(1, 'second')}

      {matched && total && (
        <div className="fb-row fb-total">
          <div className="fb-name"><strong>{label(total)}</strong><small>together</small></div>
          <Bar part={total} k={1} tone="total" name="Together" />
        </div>
      )}

      <p className={`fb-status ${matched ? 'match' : 'differ'}`} aria-live="polite">{status}</p>
      <button type="button" className="fb-reset" onClick={() => setSplits([1, 1])} disabled={splits[0] === 1 && splits[1] === 1}>
        Start again
      </button>
    </section>
  );
}
