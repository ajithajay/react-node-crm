import type { Request, Response } from 'express';
import type { RecordListQuery } from '@saasly/shared';
import { AppError } from '../../lib/errors.js';
import type { Principal } from './record-permission.js';
import * as recordService from './record.service.js';

/** The acting principal — an API key when present (gap E3), otherwise the logged-in user. */
function principalOf(req: Request): Principal {
  if (req.apiKey) {
    return { type: 'apiKey', apiKeyId: req.apiKey.id, roleId: req.apiKey.roleId, name: req.apiKey.name };
  }
  return { type: 'user', userId: req.user!.id };
}

export async function index(req: Request<{ objectNamePlural: string }>, res: Response): Promise<void> {
  // validate() has already replaced req.query with the parsed+coerced RecordListQuery at runtime.
  const result = await recordService.listRecords(
    req.workspaceId!,
    principalOf(req),
    req.params.objectNamePlural,
    req.query as unknown as RecordListQuery,
  );
  res.status(200).json(result);
}

export async function show(
  req: Request<{ objectNamePlural: string; id: string }>,
  res: Response,
): Promise<void> {
  const result = await recordService.getRecord(req.workspaceId!, principalOf(req), req.params.objectNamePlural, req.params.id);
  res.status(200).json(result);
}

export async function create(
  req: Request<{ objectNamePlural: string }, unknown, Record<string, unknown>>,
  res: Response,
): Promise<void> {
  const result = await recordService.createRecord(req.workspaceId!, principalOf(req), req.params.objectNamePlural, req.body);
  res.status(201).json(result);
}

export async function update(
  req: Request<{ objectNamePlural: string; id: string }, unknown, Record<string, unknown>>,
  res: Response,
): Promise<void> {
  const result = await recordService.updateRecord(
    req.workspaceId!,
    principalOf(req),
    req.params.objectNamePlural,
    req.params.id,
    req.body,
  );
  res.status(200).json(result);
}

export async function destroy(req: Request<{ objectNamePlural: string; id: string }>, res: Response): Promise<void> {
  await recordService.deleteRecord(
    req.workspaceId!,
    principalOf(req),
    req.params.objectNamePlural,
    req.params.id,
    req.query.hard === 'true',
  );
  res.status(200).json({ ok: true });
}

export async function exportCsv(req: Request<{ objectNamePlural: string }>, res: Response): Promise<void> {
  // validate() has already replaced req.query with the parsed+coerced RecordListQuery at runtime.
  const { filename, csv } = await recordService.exportRecordsCsv(
    req.workspaceId!,
    principalOf(req),
    req.params.objectNamePlural,
    req.query as unknown as RecordListQuery,
  );
  res.status(200).header('Content-Type', 'text/csv; charset=utf-8').header('Content-Disposition', `attachment; filename="${filename}"`).send(csv);
}

export async function importCsv(req: Request<{ objectNamePlural: string }>, res: Response): Promise<void> {
  if (!req.file) throw new AppError('No file uploaded', 400);
  const summary = await recordService.importRecordsCsv(
    req.workspaceId!,
    principalOf(req),
    req.params.objectNamePlural,
    req.file.buffer.toString('utf-8'),
  );
  res.status(200).json(summary);
}
