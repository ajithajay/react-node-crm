import { DataSource } from 'typeorm';
import { ObjectMetadataEntity } from '../entities/object-metadata.entity.js';
import { FieldMetadataEntity } from '../entities/field-metadata.entity.js';
import { WorkspaceEntity, WorkspaceMetadataVersionEntity } from '../entities/workspace.entity.js';
import { buildEntitySchema } from './entity-schema.factory.js';

interface CacheEntry {
  dataSource: DataSource;
  version: number;
}

/**
 * LRU cache of per-workspace TypeORM DataSources (solution-approach.md §4.6). Each entry is
 * rebuilt whenever the workspace's `workspace_metadata_versions.version` changes — i.e. whenever
 * an object/field is created, updated, or deleted (see metadata.service.ts).
 *
 * Tradeoff (documented): one connection pool per active workspace. Fine at v1 scale; Twenty's
 * single-pool + schema-qualified-metadata approach is the v2 optimization if pool count bites.
 */
export function createWorkspaceDataSourceCache(
  coreDataSource: DataSource,
  databaseUrl: string,
  maxSize = 20,
) {
  const cache = new Map<string, CacheEntry>();

  async function destroy(entry: CacheEntry): Promise<void> {
    if (entry.dataSource.isInitialized) await entry.dataSource.destroy();
  }

  async function evictIfNeeded(): Promise<void> {
    while (cache.size > maxSize) {
      const oldestKey = cache.keys().next().value;
      if (oldestKey === undefined) break;
      const entry = cache.get(oldestKey);
      cache.delete(oldestKey);
      if (entry) await destroy(entry);
    }
  }

  return {
    async getWorkspaceDataSource(workspaceId: string): Promise<DataSource> {
      const workspace = await coreDataSource
        .getRepository(WorkspaceEntity)
        .findOneByOrFail({ id: workspaceId });
      const versionRow = await coreDataSource
        .getRepository(WorkspaceMetadataVersionEntity)
        .findOneBy({ workspaceId });
      const currentVersion = versionRow?.version ?? 1;

      const cached = cache.get(workspaceId);
      if (cached && cached.version === currentVersion) {
        // Touch for LRU recency.
        cache.delete(workspaceId);
        cache.set(workspaceId, cached);
        return cached.dataSource;
      }
      if (cached) {
        cache.delete(workspaceId);
        await destroy(cached);
      }

      const [objects, fields] = await Promise.all([
        coreDataSource.getRepository(ObjectMetadataEntity).findBy({ workspaceId, isActive: true }),
        coreDataSource.getRepository(FieldMetadataEntity).findBy({ workspaceId, isActive: true }),
      ]);

      const entitySchemas = objects.map((object) =>
        buildEntitySchema(
          object,
          fields.filter((f) => f.objectMetadataId === object.id),
          workspace.databaseSchema,
        ),
      );

      const dataSource = new DataSource({
        type: 'postgres',
        url: databaseUrl,
        schema: workspace.databaseSchema,
        entities: entitySchemas,
        synchronize: false,
        logging: false,
      });
      await dataSource.initialize();

      cache.set(workspaceId, { dataSource, version: currentVersion });
      await evictIfNeeded();

      return dataSource;
    },

    async closeAll(): Promise<void> {
      for (const entry of cache.values()) await destroy(entry);
      cache.clear();
    },
  };
}

export type WorkspaceDataSourceCache = ReturnType<typeof createWorkspaceDataSourceCache>;
