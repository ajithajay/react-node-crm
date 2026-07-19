import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { LogicalOperator, RowLevelPermissionValueMode, ViewFilterOperand } from '@saasly/shared';

@Entity({ name: 'roles' })
@Index(['workspaceId', 'name'], { unique: true })
export class RoleEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  label!: string;

  /** lucide-react icon name shown next to the role, e.g. "User". */
  @Column({ type: 'varchar', default: 'User' })
  icon!: string;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'boolean', name: 'is_editable', default: true })
  isEditable!: boolean;

  @Column({ type: 'boolean', name: 'can_update_all_settings', default: false })
  canUpdateAllSettings!: boolean;

  @Column({ type: 'boolean', name: 'can_read_all_object_records', default: false })
  canReadAllObjectRecords!: boolean;

  @Column({ type: 'boolean', name: 'can_update_all_object_records', default: false })
  canUpdateAllObjectRecords!: boolean;

  @Column({ type: 'boolean', name: 'can_soft_delete_all_object_records', default: false })
  canSoftDeleteAllObjectRecords!: boolean;

  @Column({ type: 'boolean', name: 'can_destroy_all_object_records', default: false })
  canDestroyAllObjectRecords!: boolean;

  @Column({ type: 'boolean', name: 'can_access_all_tools', default: false })
  canAccessAllTools!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

@Entity({ name: 'role_permission_flags' })
@Index(['roleId', 'flag'], { unique: true })
export class RolePermissionFlagEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId!: string;

  @Column({ type: 'varchar' })
  flag!: string;
}

@Entity({ name: 'object_permissions' })
@Index(['roleId', 'objectMetadataId'], { unique: true })
export class ObjectPermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId!: string;

  @Column({ type: 'uuid', name: 'object_metadata_id' })
  objectMetadataId!: string;

  /** null = inherit the role's blanket `canXAllObjectRecords` flag; true/false = explicit override. */
  @Column({ type: 'boolean', name: 'can_read', nullable: true })
  canRead!: boolean | null;

  @Column({ type: 'boolean', name: 'can_update', nullable: true })
  canUpdate!: boolean | null;

  @Column({ type: 'boolean', name: 'can_soft_delete', nullable: true })
  canSoftDelete!: boolean | null;

  @Column({ type: 'boolean', name: 'can_destroy', nullable: true })
  canDestroy!: boolean | null;
}

@Entity({ name: 'field_permissions' })
@Index(['roleId', 'fieldMetadataId'], { unique: true })
export class FieldPermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId!: string;

  @Column({ type: 'uuid', name: 'field_metadata_id' })
  fieldMetadataId!: string;

  /** null = readable/editable by default; true is never persisted, only false (a restriction) or null. */
  @Column({ type: 'boolean', name: 'can_read', nullable: true })
  canRead!: boolean | null;

  @Column({ type: 'boolean', name: 'can_update', nullable: true })
  canUpdate!: boolean | null;
}

/**
 * One condition of a role+object's row-level permission rule — a flat, ordered list combined with
 * AND/OR (no nested groups, v1 scope). Applies uniformly to read/update/delete (no per-operation
 * split) and to both workspace members and API keys. `valueMode: CURRENT_USER` resolves `value`
 * against the caller's workspace-member id at query time instead of using the stored literal.
 */
@Entity({ name: 'row_level_permissions' })
@Index(['roleId', 'objectMetadataId'])
export class RowLevelPermissionEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'role_id' })
  roleId!: string;

  @Column({ type: 'uuid', name: 'object_metadata_id' })
  objectMetadataId!: string;

  @Column({ type: 'uuid', name: 'field_metadata_id' })
  fieldMetadataId!: string;

  @Column({ type: 'varchar' })
  operand!: ViewFilterOperand;

  @Column({ type: 'varchar', name: 'value_mode', default: 'LITERAL' })
  valueMode!: RowLevelPermissionValueMode;

  @Column({ type: 'jsonb', nullable: true })
  value!: unknown;

  @Column({ type: 'varchar', name: 'logical_operator', default: 'AND' })
  logicalOperator!: LogicalOperator;

  @Column({ type: 'int', default: 0 })
  position!: number;
}
