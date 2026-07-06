import { UserEntity } from './user.entity.js';
import { WorkspaceEntity, WorkspaceMetadataVersionEntity } from './workspace.entity.js';
import { UserWorkspaceEntity, WorkspaceMemberEntity, InvitationEntity } from './membership.entity.js';
import {
  RoleEntity,
  RolePermissionFlagEntity,
  ObjectPermissionEntity,
  FieldPermissionEntity,
} from './role.entity.js';
import { ObjectMetadataEntity } from './object-metadata.entity.js';
import { FieldMetadataEntity } from './field-metadata.entity.js';
import { IndexMetadataEntity } from './index-metadata.entity.js';
import {
  ViewEntity,
  ViewFieldEntity,
  ViewFilterEntity,
  ViewSortEntity,
  ViewGroupEntity,
} from './view.entity.js';
import { FavoriteEntity } from './favorite.entity.js';
import { ApiKeyEntity } from './api-key.entity.js';
import { WebhookEntity } from './webhook.entity.js';
import { RefreshTokenEntity, TwoFactorMethodEntity } from './auth-token.entity.js';
import { FileEntity } from './file.entity.js';
import { AuditLogEntity } from './audit-log.entity.js';

export * from './user.entity.js';
export * from './workspace.entity.js';
export * from './membership.entity.js';
export * from './role.entity.js';
export * from './object-metadata.entity.js';
export * from './field-metadata.entity.js';
export * from './index-metadata.entity.js';
export * from './view.entity.js';
export * from './favorite.entity.js';
export * from './api-key.entity.js';
export * from './webhook.entity.js';
export * from './auth-token.entity.js';
export * from './file.entity.js';
export * from './audit-log.entity.js';

/** Every core-schema entity, registered on the core DataSource. */
export const CORE_ENTITIES = [
  UserEntity,
  WorkspaceEntity,
  WorkspaceMetadataVersionEntity,
  UserWorkspaceEntity,
  WorkspaceMemberEntity,
  InvitationEntity,
  RoleEntity,
  RolePermissionFlagEntity,
  ObjectPermissionEntity,
  FieldPermissionEntity,
  ObjectMetadataEntity,
  FieldMetadataEntity,
  IndexMetadataEntity,
  ViewEntity,
  ViewFieldEntity,
  ViewFilterEntity,
  ViewSortEntity,
  ViewGroupEntity,
  FavoriteEntity,
  ApiKeyEntity,
  WebhookEntity,
  RefreshTokenEntity,
  TwoFactorMethodEntity,
  FileEntity,
  AuditLogEntity,
];
