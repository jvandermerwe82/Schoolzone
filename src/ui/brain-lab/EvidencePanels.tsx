import { CANONICAL_STATUS, type CanonicalNodeView, type TraceStepView } from '../../brain-view/views';
import { Card, num, pct, Row, StatusPill } from './parts';

export function NodeSummary({ node, role }: { node: CanonicalNodeView; role: string }) {
  return (
    <article className="bl-node" aria-label={`${role}: ${node.title}`}>
      <header>
        <span className="bl-role">{role}</span>
        <StatusPill tone={node.tone}>{node.statusLabel}</StatusPill>
      </header>
      <h4>{node.title}</h4>
      <p className="bl-muted">{node.curriculumCode ? `Australian Curriculum v9 ${node.curriculumCode}` : 'No verified curriculum code'} · {node.strand}</p>
      <p className="bl-note">{CANONICAL_STATUS[node.status].gloss}</p>
      <dl className="bl-dl">
        <Row k="Direct evidence">{node.directEvidence} answers: {node.independentDirect} with no help, {node.assistedDirect} with help</Row>
        <Row k="Supporting evidence">{node.supportingEvidence} answers (cannot prove mastery alone)</Row>
        <Row k="Weighted success">{pct(node.weightedSuccess)}</Row>
        <Row k="Confidence">{num(node.confidence)}</Row>
        <Row k="Evidence types">{node.evidenceModes.join(', ')}{node.autoMasterable ? '' : ' (not provable by app questions alone)'}</Row>
        {node.practice && (
          <Row k="Practice route">
            {node.practice.name}, coverage <strong>{node.practice.coverage ?? 'unrated'}</strong>
            {node.practice.coverageNote ? `. ${node.practice.coverageNote}` : ''}
          </Row>
        )}
      </dl>
      {node.caveat && <p className="bl-warn" role="note">{node.caveat}</p>}
    </article>
  );
}

export function EvidenceCard({ step }: { step: TraceStepView }) {
  const { activeNode, targetNode } = step;
  const same = activeNode && targetNode && activeNode.nodeId === targetNode.nodeId;
  return (
    <Card title="Curriculum evidence (the authority)" source="live-engine-synthetic" id="evidence" wide>
      <p className="bl-note">
        Curriculum status comes from the canonical evidence model. It is separate from the learner-model estimates above, and it splits
        answers given alone from answers given with help.
      </p>
      <div className="bl-nodes">
        {activeNode && <NodeSummary node={activeNode} role={same ? 'Practising now (the teacher’s goal)' : 'Practising now'} />}
        {targetNode && !same && <NodeSummary node={targetNode} role="The teacher’s goal" />}
      </div>
    </Card>
  );
}
