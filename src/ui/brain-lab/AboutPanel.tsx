import { useState } from 'react';
import {
  adaptive80Policy, BRAIN_LAB_THRESHOLDS, compareBenchmarks, currentBrainPolicy, evaluateBrainLabGate, runBenchmark,
} from '../../brain-lab/benchmark';
import { syntheticPopulation } from '../../brain-lab/synthetic';
import { DATA_SOURCES } from '../../brain-view/provenance';
import { selectContractVersions } from '../../brain-view/selectors';
import { Card, Row, SourceBadge } from './parts';

interface GateResult { pass: boolean; failures: string[]; learningGain: number; mae: number; brier: number; calibration: number; seconds: number }

function runMainGate(): GateResult {
  const started = performance.now();
  const population = syntheticPopulation(84);
  const options = { population, answersPerLearner: 30, seed: 20260925 };
  const current = runBenchmark('current', currentBrainPolicy, options);
  const adaptive = runBenchmark('adaptive-80', adaptive80Policy, options);
  compareBenchmarks(current, adaptive);
  const gate = evaluateBrainLabGate(current);
  return {
    pass: gate.pass, failures: gate.failures, learningGain: gate.learningGain,
    mae: current.finalAbilityMae, brier: current.meanPredictionBrier, calibration: current.calibrationGap,
    seconds: (performance.now() - started) / 1000,
  };
}

export function AboutPanel() {
  const versions = selectContractVersions();
  const [gate, setGate] = useState<GateResult | null>(null);
  const [running, setRunning] = useState(false);

  return (
    <>
      <Card title="Where every number comes from" source="illustrative-demo" id="provenance" wide>
        <ul className="bl-provenance">
          {Object.values(DATA_SOURCES).map((info) => (
            <li key={info.source}>
              <SourceBadge source={info.source} />
              <span>{info.description}</span>
              {!info.availableInThisBuild && <strong> Not available in this build.</strong>}
            </li>
          ))}
        </ul>
        <p className="bl-note">
          This lab runs the real planning, learner-model and curriculum-evidence code on invented learners. It reads no profile, calls no
          server, and stores nothing. It cannot change mastery, and no AI output is used anywhere in it.
        </p>
      </Card>

      <Card title="Contract versions in this build" source="live-engine-synthetic" id="versions">
        <dl className="bl-dl">
          <Row k="Learning Intelligence">v{versions.learningIntelligence}</Row>
          <Row k="Pilot evidence">v{versions.pilotEvidence}</Row>
          <Row k="Animated support">v{versions.animatedSupport}</Row>
          <Row k="Parent consent">{versions.consent}</Row>
          <Row k="Curriculum">{versions.curriculum.name} v{versions.curriculum.version}</Row>
        </dl>
        <p className="bl-note">{versions.note}</p>
      </Card>

      <Card title="Existing Brain Lab gate" source="live-engine-synthetic" id="gate">
        <p className="bl-note">
          The same benchmark that CI runs with <code>npm run brain:lab</code>, on hidden synthetic learners. The other gates
          (support, misconception, retention, session, scaffold, teacher intent) run only from that command.
        </p>
        <button type="button" className="bl-button" disabled={running} onClick={() => {
          setRunning(true);
          window.setTimeout(() => { setGate(runMainGate()); setRunning(false); }, 30);
        }}>
          {running ? 'Running…' : 'Run the main gate now'}
        </button>
        {gate && (
          <div role="status" className={`bl-gate ${gate.pass ? 'pass' : 'fail'}`}>
            <strong>{gate.pass ? 'Pass' : 'Fail'}</strong> in {gate.seconds.toFixed(1)} s
            <dl className="bl-dl">
              <Row k="Final ability error">{gate.mae.toFixed(3)} (limit {BRAIN_LAB_THRESHOLDS.maxFinalAbilityMae})</Row>
              <Row k="Prediction Brier score">{gate.brier.toFixed(3)} (limit {BRAIN_LAB_THRESHOLDS.maxPredictionBrier})</Row>
              <Row k="Calibration gap">{gate.calibration.toFixed(3)} (limit {BRAIN_LAB_THRESHOLDS.maxCalibrationGap})</Row>
              <Row k="Learning gain">{gate.learningGain.toFixed(3)} (needs {BRAIN_LAB_THRESHOLDS.minAbilityMaeImprovementFromAnswer2})</Row>
            </dl>
            {gate.failures.length > 0 && <ul>{gate.failures.map((f) => <li key={f}>{f}</li>)}</ul>}
          </div>
        )}
      </Card>
    </>
  );
}
