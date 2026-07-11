import type { Request, Response } from 'express';
import { AppError } from '../../lib/errors.js';
import { getFile, uploadFile } from './file.service.js';

export async function serve(req: Request<{ id: string }>, res: Response): Promise<void> {
  const file = await getFile(req.params.id, req.workspaceId!);
  res.setHeader('Content-Type', file.mimeType ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(file.buffer);
}

/** Generic upload used by the record Files tab (attachment records) — see record module. */
export async function upload(req: Request, res: Response): Promise<void> {
  if (!req.file) throw new AppError('No file uploaded', 400);
  const result = await uploadFile(req.workspaceId!, req.file.buffer, req.file.originalname, req.file.mimetype, 'attachments');
  res.status(201).json(result);
}
