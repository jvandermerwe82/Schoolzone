import { useMemo, useState, type PointerEvent as ReactPointerEvent } from 'react';
import type { Question } from '../brain/types';
import {
  encodeCoordinatePoints,
  type CoordinatePoint,
} from '../content/coordinates';

interface Props {
  question: Question;
  disabled: boolean;
  feedbackCorrect?: boolean;
  onSubmit: (answer: string) => void;
}

const VIEW = 500;
const PAD = 42;
const PLOT = VIEW - PAD * 2;

const displayNumber = (value: number) => String(value).replace('-', '−');
const pointLabel = ([x, y]: CoordinatePoint) => `(${displayNumber(x)}, ${displayNumber(y)})`;
const pointKey = ([x, y]: CoordinatePoint) => `${x},${y}`;

export function CoordinatePlotQuestion({
  question,
  disabled,
  feedbackCorrect,
  onSubmit,
}: Props) {
  const interaction = question.interaction;
  const [points, setPoints] = useState<CoordinatePoint[]>([]);

  if (!interaction || interaction.kind !== 'coordinate-plot') return null;

  const targets = useMemo<CoordinatePoint[]>(
    () => interaction.xValues.map((x, index) => [x, interaction.yValues[index]] as const),
    [interaction.xValues, interaction.yValues],
  );
  const targetCount = targets.length;

  const xTicks = useMemo(
    () => Array.from(
      { length: Math.floor(interaction.xMax) - Math.ceil(interaction.xMin) + 1 },
      (_, index) => Math.ceil(interaction.xMin) + index,
    ),
    [interaction.xMin, interaction.xMax],
  );
  const yTicks = useMemo(
    () => Array.from(
      { length: Math.floor(interaction.yMax) - Math.ceil(interaction.yMin) + 1 },
      (_, index) => Math.ceil(interaction.yMin) + index,
    ),
    [interaction.yMin, interaction.yMax],
  );

  const sx = (x: number) => PAD + ((x - interaction.xMin) / (interaction.xMax - interaction.xMin)) * PLOT;
  const sy = (y: number) => PAD + ((interaction.yMax - y) / (interaction.yMax - interaction.yMin)) * PLOT;

  const orderedSelected = useMemo(
    () => [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    [points],
  );
  const orderedTargets = useMemo(
    () => [...targets].sort((a, b) => a[0] - b[0] || a[1] - b[1]),
    [targets],
  );

  function choosePoint(event: ReactPointerEvent<SVGSVGElement>) {
    if (disabled) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const vx = ((event.clientX - rect.left) / rect.width) * VIEW;
    const vy = ((event.clientY - rect.top) / rect.height) * VIEW;
    if (vx < PAD || vx > VIEW - PAD || vy < PAD || vy > VIEW - PAD) return;

    const x = Math.round(interaction.xMin + ((vx - PAD) / PLOT) * (interaction.xMax - interaction.xMin));
    const y = Math.round(interaction.yMax - ((vy - PAD) / PLOT) * (interaction.yMax - interaction.yMin));
    const next: CoordinatePoint = [x, y];
    const existing = points.findIndex(([px, py]) => px === x && py === y);

    if (existing >= 0) {
      setPoints((current) => current.filter((_, index) => index !== existing));
      return;
    }

    if (points.length >= targetCount) return;
    setPoints((current) => [...current, next]);
  }

  function removePoint(point: CoordinatePoint) {
    if (disabled) return;
    setPoints((current) => current.filter(([x, y]) => x !== point[0] || y !== point[1]));
  }

  const canCheck = points.length === targetCount && !disabled;
  const selectedPolyline = orderedSelected.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ');
  const targetPolyline = orderedTargets.map(([x, y]) => `${sx(x)},${sy(y)}`).join(' ');

  return (
    <section className="coordinate-question" aria-label="Interactive coordinate grid">
      <div className="coordinate-layout">
        <div className="coordinate-data-panel">
          <div className="coordinate-kicker">Table of values</div>
          <table className="coordinate-table">
            <tbody>
              <tr>
                <th scope="row">x</th>
                {interaction.xValues.map((value, index) => <td key={`x-${index}`}>{displayNumber(value)}</td>)}
              </tr>
              <tr>
                <th scope="row">y</th>
                {interaction.yValues.map((value, index) => <td key={`y-${index}`}>{displayNumber(value)}</td>)}
              </tr>
            </tbody>
          </table>

          <div className="coordinate-progress" aria-live="polite">
            <strong>{points.length} of {targetCount}</strong> {targetCount === 1 ? 'point' : 'points'} plotted
          </div>
          <p className="coordinate-instruction">
            Tap an intersection on the grid. Tap a selected point again to remove it.
          </p>

          {points.length > 0 && (
            <div className="coordinate-selected" aria-label="Selected points">
              {points.map((point) => (
                <button
                  type="button"
                  key={pointKey(point)}
                  onClick={() => removePoint(point)}
                  disabled={disabled}
                  aria-label={`Remove point ${pointLabel(point)}`}
                >
                  {pointLabel(point)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="coordinate-grid-shell">
          <svg
            className={`coordinate-grid ${disabled ? 'locked' : ''}`}
            viewBox={`0 0 ${VIEW} ${VIEW}`}
            role="application"
            aria-label={`Coordinate grid from x ${interaction.xMin} to ${interaction.xMax} and y ${interaction.yMin} to ${interaction.yMax}`}
            onPointerDown={choosePoint}
          >
            <rect x={PAD} y={PAD} width={PLOT} height={PLOT} className="cg-paper" rx="8" />

            {xTicks.map((x) => (
              <line
                key={`vx-${x}`}
                x1={sx(x)}
                y1={PAD}
                x2={sx(x)}
                y2={VIEW - PAD}
                className={x === 0 ? 'cg-axis' : 'cg-grid-line'}
              />
            ))}
            {yTicks.map((y) => (
              <line
                key={`hy-${y}`}
                x1={PAD}
                y1={sy(y)}
                x2={VIEW - PAD}
                y2={sy(y)}
                className={y === 0 ? 'cg-axis' : 'cg-grid-line'}
              />
            ))}

            {xTicks.map((x) => (
              <text
                key={`xl-${x}`}
                x={sx(x)}
                y={Math.min(VIEW - 12, Math.max(PAD + 18, sy(0) + 18))}
                textAnchor="middle"
                className="cg-tick"
              >
                {x === 0 ? '' : displayNumber(x)}
              </text>
            ))}
            {yTicks.map((y) => (
              <text
                key={`yl-${y}`}
                x={Math.min(VIEW - PAD - 8, Math.max(PAD + 8, sx(0) + 9))}
                y={sy(y) + 4}
                textAnchor="start"
                className="cg-tick"
              >
                {y === 0 ? '' : displayNumber(y)}
              </text>
            ))}

            <text x={VIEW - PAD + 17} y={Math.min(VIEW - 18, Math.max(22, sy(0) + 5))} className="cg-axis-label">x</text>
            <text x={Math.min(VIEW - 24, Math.max(18, sx(0) + 8))} y={PAD - 15} className="cg-axis-label">y</text>
            <text x={sx(0) - 13} y={sy(0) + 18} className="cg-origin">0</text>

            {interaction.connect && points.length > 1 && (
              <polyline points={selectedPolyline} className={disabled && feedbackCorrect ? 'cg-line correct' : 'cg-line'} />
            )}

            {disabled && feedbackCorrect === false && interaction.connect && targets.length > 1 && (
              <polyline points={targetPolyline} className="cg-line target" />
            )}

            {points.map(([x, y]) => (
              <g key={`selected-${x}-${y}`} className={disabled ? (feedbackCorrect ? 'cg-point correct' : 'cg-point submitted') : 'cg-point'}>
                <circle cx={sx(x)} cy={sy(y)} r="10" />
                <circle cx={sx(x)} cy={sy(y)} r="3" className="cg-point-core" />
              </g>
            ))}

            {disabled && feedbackCorrect === false && targets.map(([x, y]) => (
              <g key={`target-${x}-${y}`} className="cg-point target">
                <circle cx={sx(x)} cy={sy(y)} r="10" />
                <path d={`M ${sx(x) - 4} ${sy(y)} L ${sx(x) + 4} ${sy(y)} M ${sx(x)} ${sy(y) - 4} L ${sx(x)} ${sy(y) + 4}`} />
              </g>
            ))}
          </svg>
        </div>
      </div>

      {!disabled && (
        <div className="coordinate-actions">
          <button
            type="button"
            onClick={() => setPoints((current) => current.slice(0, -1))}
            disabled={points.length === 0}
          >
            Undo
          </button>
          <button type="button" onClick={() => setPoints([])} disabled={points.length === 0}>
            Clear
          </button>
          <button
            type="button"
            className="primary"
            disabled={!canCheck}
            onClick={() => onSubmit(encodeCoordinatePoints(points))}
          >
            Check points
          </button>
        </div>
      )}
    </section>
  );
}
