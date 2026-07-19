import type { Request, Response } from 'express';
import type {
  CreateWorkflowRequest,
  RunWorkflowRequest,
  UpdateWorkflowRequest,
  UpdateWorkflowVersionRequest,
  WorkflowRunQuery,
} from '@saasly/shared';
import * as workflowService from './workflow.service.js';
import * as testService from './test.service.js';

// Structural pick (not full `Request`) so handlers on param-less routes still type-check.
const actorUserIdOf = (req: Pick<Request, 'user'>): string => req.user!.id;

export async function index(req: Request, res: Response): Promise<void> {
  res.status(200).json(await workflowService.listWorkflows(req.workspaceId!));
}

export async function show(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.status(200).json(await workflowService.getWorkflow(req.workspaceId!, req.params.id));
}

export async function create(
  req: Request<unknown, unknown, CreateWorkflowRequest>,
  res: Response,
): Promise<void> {
  const result = await workflowService.createWorkflow(req.workspaceId!, actorUserIdOf(req), req.body.name);
  res.status(201).json(result);
}

export async function update(
  req: Request<{ id: string }, unknown, UpdateWorkflowRequest>,
  res: Response,
): Promise<void> {
  const result = await workflowService.updateWorkflow(
    req.workspaceId!,
    req.params.id,
    actorUserIdOf(req),
    req.body.name,
  );
  res.status(200).json(result);
}

export async function destroy(req: Request<{ id: string }>, res: Response): Promise<void> {
  await workflowService.deleteWorkflow(req.workspaceId!, req.params.id, actorUserIdOf(req));
  res.status(204).send();
}

export async function getDraft(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await workflowService.getUpdatableVersion(
    req.workspaceId!,
    req.params.id,
    actorUserIdOf(req),
  );
  res.status(200).json(result);
}

export async function updateVersion(
  req: Request<{ id: string; versionId: string }, unknown, UpdateWorkflowVersionRequest>,
  res: Response,
): Promise<void> {
  const result = await workflowService.updateVersion(
    req.workspaceId!,
    req.params.id,
    req.params.versionId,
    actorUserIdOf(req),
    req.body,
  );
  res.status(200).json(result);
}

export async function listVersions(req: Request<{ id: string }>, res: Response): Promise<void> {
  res.status(200).json(await workflowService.listVersions(req.workspaceId!, req.params.id));
}

export async function activate(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await workflowService.activateWorkflow(req.workspaceId!, req.params.id, actorUserIdOf(req));
  res.status(200).json(result);
}

export async function deactivate(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await workflowService.deactivateWorkflow(req.workspaceId!, req.params.id, actorUserIdOf(req));
  res.status(200).json(result);
}

export async function duplicate(req: Request<{ id: string }>, res: Response): Promise<void> {
  const result = await workflowService.duplicateWorkflow(req.workspaceId!, req.params.id, actorUserIdOf(req));
  res.status(201).json(result);
}

export async function run(
  req: Request<{ id: string }, unknown, RunWorkflowRequest>,
  res: Response,
): Promise<void> {
  const result = await workflowService.runWorkflowManually(
    req.workspaceId!,
    req.params.id,
    actorUserIdOf(req),
    req.body.payload ?? {},
  );
  res.status(202).json(result);
}

export async function listRuns(req: Request, res: Response): Promise<void> {
  // validate() has already replaced req.query with the parsed+coerced WorkflowRunQuery at runtime.
  res.status(200).json(await workflowService.listRuns(req.workspaceId!, req.query as unknown as WorkflowRunQuery));
}

export async function showRun(req: Request<{ runId: string }>, res: Response): Promise<void> {
  res.status(200).json(await workflowService.getRun(req.workspaceId!, req.params.runId));
}

export async function testHttp(req: Request, res: Response): Promise<void> {
  res.status(200).json(await testService.runHttpTest(req.body ?? {}));
}

export async function testCode(req: Request, res: Response): Promise<void> {
  const { code, params } = (req.body ?? {}) as { code?: string; params?: Record<string, unknown> };
  res.status(200).json(await testService.runCodeTest(code ?? '', params ?? {}));
}
