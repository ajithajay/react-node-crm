import { createContext, useContext } from 'react';

export interface WorkflowCanvasContextValue {
  selectedId: string | null;
  onSelect: (nodeId: string) => void;
  onAddAfter: (nodeId: string) => void;
  readonly: boolean;
}

export const WorkflowCanvasContext = createContext<WorkflowCanvasContextValue | null>(null);

export function useWorkflowCanvas(): WorkflowCanvasContextValue {
  const ctx = useContext(WorkflowCanvasContext);
  if (!ctx) throw new Error('useWorkflowCanvas must be used within a WorkflowCanvasContext');
  return ctx;
}
