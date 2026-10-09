import { useEffect, useMemo, useState, type KeyboardEvent } from 'react';
import { DATA_SOURCES } from '../../brain-view/provenance';
import { SCENARIOS, scenarioById } from '../../brain-view/scenarios';
import { runTrace } from '../../brain-view/trace';
import type { TraceEntry, TraceStepView } from '../../brain-view/views';
import { AboutPanel } from './AboutPanel';
import { AdultViews } from './AdultViews';
import { ConceptGraph } from './ConceptGraph';
import { AnswerCard, ChangeCard, DecisionCard } from './DecisionPanels';
import { EvidenceCard } from './EvidencePanels';
import { BreakCard, EpisodeCard, MisconceptionCard, RouteCard, StrategyCard, SupportCard } from './HelpPanels';
import { LessonPreview } from './LessonPreview';
import { SourceBadge } from './parts';

type Tab = 'trace' | 'concepts' | 'adults' | 'lesson' | 'about';
const TABS: { id: Tab; label: string }[] = [
  { id: 'trace', label: 'Decision trace' },
  { id: 'concepts', label: 'Concepts' },
  { id: 'adults', label: 'Parent and teacher' },
  { id: 'lesson', label: 'Lesson preview' },
  { id: 'about', label: 'Sources and gates' },
];

const stepTag = (entry: TraceEntry): { text: string; tone: string } => {
  if (entry.kind === 'break') return { text: 'break', tone: 'break' };
  switch (entry.result.helpEvent) {
    case 'stuck': return { text: 'stuck', tone: 'stuck' };
    case 'switched': return { text: 'switch', tone: 'switched' };
    case 'helped': return { text: 'helped', tone: 'helped' };
    case 'resolved': return { text: 'back on track', tone: 'resolved' };
    default: return { text: entry.input.correct ? 'right' : 'wrong', tone: entry.input.correct ? 'right' : 'wrong' };
  }
};

export function BrainLab() {
  const [scenarioId, setScenarioId] = useState(SCENARIOS[0].meta.id);
  const [index, setIndex] = useState(0);
  const [tab, setTab] = useState<Tab>('trace');
  const scenario = scenarioById(scenarioId)!;
  const trace = useMemo(() => runTrace(scenario), [scenario]);
  const entry = trace.entries[Math.min(index, trace.entries.length - 1)];
  const lastAnswerBefore = (i: number): TraceStepView | null => {
    for (let n = Math.min(i, trace.entries.length - 1); n >= 0; n--) {
      const e = trace.entries[n];
      if (e.kind === 'answer') return e;
    }
    return null;
  };
  // Panels that describe state (graph, adults, lesson) use the latest answered step at or before the selection.
  const stateStep = lastAnswerBefore(index);

  useEffect(() => { setIndex(0); }, [scenarioId]);

  const move = (delta: number) => setIndex((i) => Math.max(0, Math.min(trace.entries.length - 1, i + delta)));
  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); move(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); move(-1); }
  };

  return (
    <div className="bl-root">
      <header className="bl-header">
        <div>
          <p className="bl-eyebrow">SchoolZone · vdM Solutions</p>
          <h1>Brain Lab</h1>
          <p className="bl-sub">See what the learning engine decides, and why.</p>
        </div>
        <ul className="bl-flags" aria-label="Status of this page">
          <li className="internal">Internal</li>
          <li>Read-only</li>
          <li>Synthetic learners only</li>
        </ul>
      </header>

      <div className="bl-banner" role="note">
        <strong>Internal tool.</strong> Everything here is produced by the real engine running on invented learners. No real child, family or school
        data is read, and nothing on this page can change any learner, mastery or setting.
        <span className="bl-legend" aria-label="Where data comes from">
          {(['live-engine-synthetic', 'illustrative-demo', 'consented-pilot-aggregate'] as const).map((s) => (
            <span key={s} className="bl-legend-item">
              <SourceBadge source={s} />
              {!DATA_SOURCES[s].availableInThisBuild && <small>not connected</small>}
            </span>
          ))}
        </span>
      </div>

      <section className="bl-scenarios" aria-label="Choose a synthetic learner">
        {SCENARIOS.map((s) => (
          <button key={s.meta.id} type="button" className={s.meta.id === scenarioId ? 'bl-scenario active' : 'bl-scenario'}
            aria-pressed={s.meta.id === scenarioId} onClick={() => setScenarioId(s.meta.id)}>
            <strong>{s.meta.title}</strong>
            <span>{s.meta.summary}</span>
          </button>
        ))}
      </section>
      <p className="bl-demonstrates"><strong>What this shows:</strong> {scenario.meta.demonstrates}</p>

      <nav className="bl-timeline-wrap" aria-label="Steps in this learner’s session">
        <button type="button" className="bl-step-btn" onClick={() => move(-1)} disabled={index === 0} aria-label="Previous step">&larr;</button>
        <ol className="bl-timeline" onKeyDown={onKey}>
          {trace.entries.map((e, i) => {
            const tag = stepTag(e);
            return (
              <li key={e.index}>
                <button type="button" className={`bl-dot ${tag.tone}${i === index ? ' current' : ''}`} aria-current={i === index ? 'step' : undefined}
                  onClick={() => setIndex(i)} aria-label={`Step ${i + 1}: ${tag.text}`}>
                  <span className="bl-dot-n">{i + 1}</span>
                  <span className="bl-dot-t">{tag.text}</span>
                </button>
              </li>
            );
          })}
        </ol>
        <button type="button" className="bl-step-btn" onClick={() => move(1)} disabled={index >= trace.entries.length - 1} aria-label="Next step">&rarr;</button>
      </nav>

      <div className="bl-tabs" role="tablist" aria-label="Views">
        {TABS.map((t) => (
          <button key={t.id} id={`tab-${t.id}`} type="button" role="tab" aria-selected={tab === t.id} aria-controls={`panel-${t.id}`} className={tab === t.id ? 'active' : ''} onClick={() => setTab(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      <main className="bl-main" id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
        {tab === 'trace' && (entry.kind === 'break' ? (
          <div className="bl-grid"><BreakCard entry={entry} /></div>
        ) : (
          <div className="bl-grid">
            <DecisionCard decision={entry.decision} />
            <AnswerCard step={entry} />
            <ChangeCard step={entry} />
            {entry.route && <RouteCard route={entry.route} />}
            <EvidenceCard step={entry} />
            {entry.strategyChoice && <StrategyCard choice={entry.strategyChoice} />}
            <EpisodeCard episode={entry.episodeAfter} />
            <MisconceptionCard items={entry.misconceptionsAfter} />
            <SupportCard support={entry.support} />
          </div>
        ))}
        {tab === 'concepts' && (stateStep ? <div className="bl-grid"><ConceptGraph graph={stateStep.graph} /></div> : <p>Choose a step after the first answer.</p>)}
        {tab === 'adults' && (stateStep ? <div className="bl-grid"><AdultViews parent={stateStep.adults.parent} teacher={stateStep.adults.teacher} /></div> : <p>Choose a step after the first answer.</p>)}
        {tab === 'lesson' && (stateStep ? <div className="bl-grid"><LessonPreview step={stateStep} /></div> : <p>Choose a step after the first answer.</p>)}
        {tab === 'about' && <div className="bl-grid"><AboutPanel /></div>}
      </main>

      <footer className="bl-footer">
        Showing step {index + 1} of {trace.entries.length}. Use the arrow keys on the step list to move.
        Learner data: {DATA_SOURCES['live-engine-synthetic'].label}.
      </footer>
    </div>
  );
}
