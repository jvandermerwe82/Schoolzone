import type { ConceptGraphView, ConceptNodeView } from '../../brain-view/views';
import { Card } from './parts';

const COL_W = 250;
const ROW_H = 74;
const NODE_W = 216;
const NODE_H = 52;

const clip = (text: string, max: number) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function ConceptGraph({ graph }: { graph: ConceptGraphView }) {
  const columns = new Map<number, ConceptNodeView[]>();
  for (const node of graph.nodes) columns.set(node.depth, [...(columns.get(node.depth) ?? []), node]);
  const tallest = Math.max(...[...columns.values()].map((c) => c.length));
  const height = tallest * ROW_H + 24;
  const width = (graph.maxDepth + 1) * COL_W + 8;

  const position = new Map<string, { x: number; y: number }>();
  for (const [depth, nodes] of columns) {
    const x = (graph.maxDepth - depth) * COL_W + 4;
    const offset = (height - nodes.length * ROW_H) / 2;
    nodes.forEach((node, i) => position.set(node.nodeId, { x, y: offset + i * ROW_H + (ROW_H - NODE_H) / 2 }));
  }

  return (
    <Card title="Concept graph: what the goal rests on" source="live-engine-synthetic" id="graph" wide>
      <p className="bl-note">
        Each box is a canonical concept with its real evidence status. Arrows run from a foundation to what depends on it.
        A dashed outline means SchoolZone has no verified practice route for it yet, so it can only be strengthened through other work.
      </p>
      <div className="bl-graph-scroll" tabIndex={0} aria-label="Concept graph, scrolls sideways on small screens">
        <svg viewBox={`0 0 ${width} ${height}`} width={width} height={height} role="img" aria-label="Concept prerequisite graph. A text list follows.">
          <defs>
            <marker id="bl-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
              <path d="M0 0 L10 5 L0 10 z" fill="#64748b" />
            </marker>
          </defs>
          {graph.edges.map((edge) => {
            const a = position.get(edge.from);
            const b = position.get(edge.to);
            if (!a || !b) return null;
            return (
              <line key={`${edge.from}>${edge.to}`} x1={a.x + NODE_W} y1={a.y + NODE_H / 2} x2={b.x} y2={b.y + NODE_H / 2}
                stroke="#94a3b8" strokeWidth="1.5" markerEnd="url(#bl-arrow)" />
            );
          })}
          {graph.nodes.map((node) => {
            const p = position.get(node.nodeId)!;
            return (
              <g key={node.nodeId} transform={`translate(${p.x} ${p.y})`}>
                <title>{`${node.title}: ${node.statusLabel}`}</title>
                <rect width={NODE_W} height={NODE_H} rx="8" className={`bl-gnode tone-${node.tone}${node.hasExecutableRoute ? '' : ' noroute'}${node.isActive ? ' active' : ''}`} />
                <text x="10" y="21" className="bl-gtitle">{clip(node.title, 33)}</text>
                <text x="10" y="40" className="bl-gstatus">{node.isTarget ? 'Goal · ' : node.isActive ? 'Now · ' : ''}{clip(node.statusLabel, 24)}</text>
              </g>
            );
          })}
        </svg>
      </div>
      <p className="bl-small">On a small screen, scroll the graph sideways.</p>
      <details className="bl-details">
        <summary>Text version of the graph</summary>
        <table className="bl-table">
          <thead><tr><th scope="col">Concept</th><th scope="col">Distance from goal</th><th scope="col">Status</th><th scope="col">Evidence (alone / with help)</th><th scope="col">Practice route</th></tr></thead>
          <tbody>
            {graph.nodes.map((node) => (
              <tr key={node.nodeId}>
                <th scope="row">{node.title}{node.isTarget ? ' (goal)' : node.isActive ? ' (practising now)' : ''}</th>
                <td>{node.depth}</td>
                <td>{node.statusLabel}</td>
                <td>{node.independentDirect} / {node.assistedDirect}</td>
                <td>{node.hasExecutableRoute ? node.practice?.name ?? 'yes' : 'none yet'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </Card>
  );
}
