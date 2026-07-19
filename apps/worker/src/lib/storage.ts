import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadBucketCommand,
  CreateBucketCommand,
} from '@aws-sdk/client-s3';
import { env } from './config.js';

/** Mirrors apps/api/src/lib/storage.ts — the housekeeping file-cleanup job needs to delete blobs
 *  directly, so the worker needs its own storage client rather than a cross-app import. */
export interface StorageDriver {
  upload(key: string, data: Buffer, contentType: string): Promise<void>;
  read(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

function createLocalStorageDriver(): StorageDriver {
  const root = env.LOCAL_STORAGE_DIR;

  return {
    async upload(key, data) {
      const filePath = join(root, key);
      await mkdir(dirname(filePath), { recursive: true });
      await writeFile(filePath, data);
    },
    async read(key) {
      return readFile(join(root, key));
    },
    async delete(key) {
      await rm(join(root, key), { force: true });
    },
  };
}

function createS3StorageDriver(): StorageDriver {
  if (!env.S3_ENDPOINT || !env.S3_ACCESS_KEY || !env.S3_SECRET_KEY || !env.S3_BUCKET) {
    throw new Error('STORAGE_TYPE=s3 requires S3_ENDPOINT, S3_ACCESS_KEY, S3_SECRET_KEY, S3_BUCKET');
  }

  const client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: { accessKeyId: env.S3_ACCESS_KEY, secretAccessKey: env.S3_SECRET_KEY },
    forcePathStyle: true, // required for MinIO
  });
  const bucket = env.S3_BUCKET;

  let bucketReady: Promise<void> | null = null;
  function ensureBucket(): Promise<void> {
    bucketReady ??= client
      .send(new HeadBucketCommand({ Bucket: bucket }))
      .catch(() => client.send(new CreateBucketCommand({ Bucket: bucket })))
      .then(() => undefined);
    return bucketReady;
  }

  return {
    async upload(key, data, contentType) {
      await ensureBucket();
      await client.send(new PutObjectCommand({ Bucket: bucket, Key: key, Body: data, ContentType: contentType }));
    },
    async read(key) {
      const result = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
      const bytes = await result.Body?.transformToByteArray();
      if (!bytes) throw new Error(`Object not found: ${key}`);
      return Buffer.from(bytes);
    },
    async delete(key) {
      await client.send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
    },
  };
}

/** Selected by STORAGE_TYPE: `local` (filesystem) or `s3` (MinIO/AWS). */
export const storageDriver: StorageDriver =
  env.STORAGE_TYPE === 's3' ? createS3StorageDriver() : createLocalStorageDriver();
