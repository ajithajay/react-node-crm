import { useMemo } from 'react';
import { Background, Controls, ReactFlow, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { WorkflowStep, WorkflowTrigger } from '@saasly/shared';
import { buildDiagram, type StepNodeData } from '../lib/diagram';
import { StepNode } from './StepNode';
import { WorkflowCanvasContext } from './canvas-context';

const nodeTypes = { step: StepNode };

interface Props {
  trigger: WorkflowTrigger | null;
  steps: WorkflowStep[];
  selectedId: string | null;
  readonly?: boolean;
  /** Override node styling (used by the run view to color by status). */
  decorate?: (node: Node<StepNodeData>) => Node<StepNodeData>;
  onSelect: (nodeId: string) => void;
  onAddAfter: (nodeId: string) => void;
}

export function WorkflowCanvas({
  trigger,
  steps,
  selectedId,
  readonly = false,
  decorate,
  onSelect,
  onAddAfter,
}: Props) {
  const { nodes, edges } = useMemo<{ nodes: Node<StepNodeData>[]; edges: Edge[] }>(() => {
    const diagram = buildDiagram(trigger, steps);
    return { nodes: decorate ? diagram.nodes.map(decorate) : diagram.nodes, edges: diagram.edges };
  }, [trigger, steps, decorate]);

  return (
    <WorkflowCanvasContext.Provider value={{ selectedId, onSelect, onAddAfter, readonly }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        fitView
        fitViewOptions={{ padding: 0.3, maxZoom: 1 }}
        minZoom={0.3}
        maxZoom={1.5}
        nodesConnectable={false}
        nodesDraggable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background />
        <Controls showInteractive={false} />
      </ReactFlow>
    </WorkflowCanvasContext.Provider>
  );
}
