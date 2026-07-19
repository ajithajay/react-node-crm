import type { Edge, Node } from '@xyflow/react';
import { TRIGGER_STEP_ID, type WorkflowStep, type WorkflowTrigger } from '@saasly/shared';
import { actionEntry } from './step-catalog';

export interface StepNodeData {
  kind: 'trigger' | 'action' | 'empty-trigger';
  label: string;
  typeLabel: string;
  icon: string;
  nodeType: string; // trigger type or action type
  valid: boolean;
  /** Set by the run view to color the node by its execution status. */
  runStatus?: string;
  [key: string]: unknown;
}

const NODE_WIDTH = 240;
const X_SPACING = 280;
const Y_SPACING = 140;

/** All outgoing step ids for a node (merges nextStepIds + if-else branch ids + iterator loop ids). */
export function outgoingIds(node: WorkflowTrigger | WorkflowStep): string[] {
  const ids = [...(node.nextStepIds ?? [])];
  const input = (node as WorkflowStep).settings?.input as
    | { branches?: { nextStepIds?: string[] }[]; initialLoopStepIds?: string[] }
    | undefined;
  if (input?.branches) for (const b of input.branches) ids.push(...(b.nextStepIds ?? []));
  if (input?.initialLoopStepIds) ids.push(...input.initialLoopStepIds);
  return [...new Set(ids)];
}

/**
 * Build ReactFlow nodes + edges from a trigger + steps DAG, with a simple layered vertical layout
 * (BFS depth → row, siblings spread across columns). The trigger is the root at id `trigger`.
 */
export function buildDiagram(
  trigger: WorkflowTrigger | null,
  steps: WorkflowStep[],
): { nodes: Node<StepNodeData>[]; edges: Edge[] } {
  const stepById = new Map(steps.map((s) => [s.id, s]));

  // Assign a layer (depth) to every node via BFS from the trigger.
  const layer = new Map<string, number>();
  layer.set(TRIGGER_STEP_ID, 0);
  const queue: string[] = [TRIGGER_STEP_ID];
  const rootOutgoing = trigger ? outgoingIds(trigger) : [];
  const childrenOf = (id: string): string[] => {
    if (id === TRIGGER_STEP_ID) return rootOutgoing;
    const step = stepById.get(id);
    return step ? outgoingIds(step) : [];
  };
  while (queue.length) {
    const id = queue.shift()!;
    const depth = layer.get(id)!;
    for (const child of childrenOf(id)) {
      if (!stepById.has(child)) continue;
      const existing = layer.get(child);
      if (existing === undefined || existing < depth + 1) {
        layer.set(child, depth + 1);
        queue.push(child);
      }
    }
  }
  // Unreachable steps get placed on their own after the deepest layer.
  let orphanRow = Math.max(0, ...[...layer.values()]) + 1;
  for (const step of steps) if (!layer.has(step.id)) layer.set(step.id, orphanRow++);

  // Group nodes by layer to spread them horizontally.
  const byLayer = new Map<number, string[]>();
  for (const [id, depth] of layer) {
    if (!byLayer.has(depth)) byLayer.set(depth, []);
    byLayer.get(depth)!.push(id);
  }

  const nodes: Node<StepNodeData>[] = [];
  for (const [depth, ids] of byLayer) {
    ids.forEach((id, index) => {
      const offset = (index - (ids.length - 1) / 2) * X_SPACING;
      const position = { x: offset, y: depth * Y_SPACING };
      if (id === TRIGGER_STEP_ID) {
        nodes.push({
          id: TRIGGER_STEP_ID,
          type: 'step',
          position,
          data: trigger
            ? {
                kind: 'trigger',
                label: trigger.name,
                typeLabel: 'Trigger',
                icon: triggerIcon(trigger.type),
                nodeType: trigger.type,
                valid: true,
              }
            : {
                kind: 'empty-trigger',
                label: 'Add a trigger',
                typeLabel: 'Trigger',
                icon: 'Zap',
                nodeType: 'EMPTY',
                valid: false,
              },
          width: NODE_WIDTH,
        });
      } else {
        const step = stepById.get(id);
        if (!step) return;
        nodes.push({
          id,
          type: 'step',
          position,
          data: {
            kind: 'action',
            label: step.name,
            typeLabel: actionEntry(step.type)?.label ?? 'Action',
            icon: actionEntry(step.type)?.icon ?? 'Circle',
            nodeType: step.type,
            valid: step.valid,
          },
          width: NODE_WIDTH,
        });
      }
    });
  }

  const edges: Edge[] = [];
  const addEdges = (from: string, node: WorkflowTrigger | WorkflowStep) => {
    for (const to of outgoingIds(node)) {
      if (!stepById.has(to)) continue;
      edges.push({ id: `${from}->${to}`, source: from, target: to, type: 'smoothstep' });
    }
  };
  if (trigger) addEdges(TRIGGER_STEP_ID, trigger);
  for (const step of steps) addEdges(step.id, step);

  return { nodes, edges };
}

function triggerIcon(type: string): string {
  switch (type) {
    case 'DATABASE_EVENT':
      return 'Database';
    case 'CRON':
      return 'Clock';
    case 'WEBHOOK':
      return 'Webhook';
    default:
      return 'MousePointerClick';
  }
}
