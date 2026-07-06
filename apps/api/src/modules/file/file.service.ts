import { randomUUID } from 'node:crypto';
import { extname } from 'node:path';
import { FileEntity } from '@saasly/database';
import { dataSource } from '../../lib/db.js';
import { storageDriver } from '../../lib/storage.js';
import { NotFoundError } from '../../lib/errors.js';

export interface UploadedFile {
  id: string;
  url: string;
}

export async function uploadFile(
  workspaceId: string,
  buffer: Buffer,
  originalName: string,
  mimeType: string,
  category: string,
): Promise<UploadedFile> {
  const key = `${workspaceId}/${category}/${randomUUID()}${extname(originalName)}`;
  await storageDriver.upload(key, buffer, mimeType);

  const file = await dataSource.getRepository(FileEntity).save(
    dataSource.getRepository(FileEntity).create({
      workspaceId,
      path: key,
      name: originalName,
      mimeType,
      size: buffer.length,
    }),
  );

  return { id: file.id, url: `/files/${file.id}` };
}

export interface ServedFile {
  buffer: Buffer;
  mimeType: string | null;
  name: string;
}

export async function getFile(fileId: string, workspaceId: string): Promise<ServedFile> {
  const file = await dataSource.getRepository(FileEntity).findOneBy({ id: fileId, workspaceId });
  if (!file) throw new NotFoundError('File not found');

  const buffer = await storageDriver.read(file.path);
  return { buffer, mimeType: file.mimeType, name: file.name };
}

/** Best-effort delete — used to clean up a file being replaced (e.g. a new avatar). */
export async function deleteFile(fileId: string, workspaceId: string): Promise<void> {
  const file = await dataSource.getRepository(FileEntity).findOneBy({ id: fileId, workspaceId });
  if (!file) return;
  await storageDriver.delete(file.path).catch(() => undefined);
  await dataSource.getRepository(FileEntity).delete({ id: fileId });
}

/** File URLs are stored as the host-relative `/files/:id` path; extracts the id back out. */
export function fileIdFromUrl(url: string | null): string | null {
  if (!url) return null;
  const match = /^\/files\/([^/]+)$/.exec(url);
  return match?.[1] ?? null;
}
