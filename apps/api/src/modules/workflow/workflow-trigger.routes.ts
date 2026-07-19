import { Router, type Request, type Response } from 'express';
import * as workflowService from './workflow.service.js';

/**
 * Public webhook trigger endpoint (no auth). Calling it
 * starts a run of the workflow's published version (if it has an ACTIVE WEBHOOK trigger), with the
 * request body (GET: query params) as the trigger payload.
 */
export const workflowTriggerRouter: Router = Router();

async function handle(req: Request<{ workspaceId: string; workflowId: string }>, res: Response): Promise<void> {
  const payload =
    req.method === 'GET' ? (req.query as Record<string, unknown>) : (req.body as Record<string, unknown>) ?? {};
  const run = await workflowService.triggerWebhookRun(req.params.workspaceId, req.params.workflowId, payload);
  res.status(202).json({ runId: run.id, status: run.status });
}

workflowTriggerRouter.post('/webhook/:workspaceId/:workflowId', handle);
workflowTriggerRouter.get('/webhook/:workspaceId/:workflowId', handle);

// Public FORM step pages: fetch a paused form's definition, and submit it (resumes the run).
workflowTriggerRouter.get(
  '/form/:workspaceId/:runId/:stepId',
  async (req: Request<{ workspaceId: string; runId: string; stepId: string }>, res: Response): Promise<void> => {
    const form = await workflowService.getPendingForm(req.params.workspaceId, req.params.runId, req.params.stepId);
    res.status(200).json(form);
  },
);
workflowTriggerRouter.post(
  '/form/:workspaceId/:runId/:stepId',
  async (
    req: Request<{ workspaceId: string; runId: string; stepId: string }, unknown, { values?: Record<string, unknown> }>,
    res: Response,
  ): Promise<void> => {
    await workflowService.submitForm(
      req.params.workspaceId,
      req.params.runId,
      req.params.stepId,
      req.body.values ?? {},
    );
    res.status(202).json({ ok: true });
  },
);
