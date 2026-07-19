import { useMemo } from 'react';
import { useQueries, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { ReactFlow, Background, Controls, type Edge, type Node } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { dataModelApi } from '@/lib/api-client';

/**
 * Settings → Data Model → Visualize: a data-model overview graph. Nodes are objects
 * (label + field list), edges are relations: a forward MANY_TO_ONE points at its target object, and a
 * MORPH_RELATION fans out to each of its targets. Frontend-only over existing metadata.
 */
export function DataModelVisualizePage() {
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const activeObjects = useMemo(() => (objects ?? []).filter((o) => o.isActive), [objects]);

  const details = useQueries({
    queries: activeObjects.map((o) => ({
      queryKey: ['data-model-object', o.id],
      queryFn: () => dataModelApi.getObject(o.id),
    })),
  });

  const { nodes, edges } = useMemo(() => {
    const loaded = details.map((d) => d.data).filter((d): d is NonNullable<typeof d> => !!d);
    const cols = Math.ceil(Math.sqrt(loaded.length || 1));
    const nodes: Node[] = loaded.map((detail, i) => {
      const scalarFields = detail.fields.filter((f) => f.type !== 'RELATION' && f.type !== 'MORPH_RELATION' && f.isRestrictable);
      return {
        id: detail.object.id,
        position: { x: (i % cols) * 280, y: Math.floor(i / cols) * 220 },
        data: {
          label: (
            <div className="text-left">
              <div className="border-b px-2 py-1 text-xs font-semibold">{detail.object.labelPlural}</div>
              <div className="max-h-32 overflow-hidden px-2 py-1 text-[10px] text-muted-foreground">
                {scalarFields.slice(0, 8).map((f) => (
                  <div key={f.id} className="truncate">
                    {f.label}
                  </div>
                ))}
              </div>
            </div>
          ),
        },
        style: { padding: 0, width: 200, borderRadius: 8 },
      };
    });

    const objectIds = new Set(loaded.map((d) => d.object.id));
    const edges: Edge[] = [];
    for (const detail of loaded) {
      for (const field of detail.fields) {
        if (field.type === 'RELATION' && field.settings?.relationType === 'MANY_TO_ONE') {
          const target = field.settings?.relationTargetObjectMetadataId as string | undefined;
          if (target && objectIds.has(target)) {
            edges.push({ id: `${field.id}`, source: detail.object.id, target, label: field.label, animated: false });
          }
        } else if (field.type === 'MORPH_RELATION') {
          const targets = (field.settings?.morphTargetObjectMetadataIds as string[] | undefined) ?? [];
          for (const target of targets) {
            if (objectIds.has(target)) {
              edges.push({ id: `${field.id}-${target}`, source: detail.object.id, target, label: field.label });
            }
          }
        }
      }
    }
    return { nodes, edges };
  }, [details]);

  return (
    <div className="flex h-[calc(100vh-3rem)] flex-col">
      <div className="flex items-center gap-2 border-b px-4 py-2">
        <Link to="/settings/objects" className="text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
        </Link>
        <h1 className="text-sm font-medium">Data model</h1>
      </div>
      <div className="min-h-0 flex-1">
        <ReactFlow nodes={nodes} edges={edges} fitView proOptions={{ hideAttribution: true }}>
          <Background />
          <Controls />
        </ReactFlow>
      </div>
    </div>
  );
}
