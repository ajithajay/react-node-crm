import type { Request, Response } from 'express';
import { getFile } from './file.service.js';

export async function serve(req: Request<{ id: string }>, res: Response): Promise<void> {
  const file = await getFile(req.params.id, req.workspaceId!);
  res.setHeader('Content-Type', file.mimeType ?? 'application/octet-stream');
  res.setHeader('Cache-Control', 'private, max-age=31536000, immutable');
  res.send(file.buffer);
}
