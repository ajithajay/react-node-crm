import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

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

  @Column({ type: 'boolean', name: 'can_read', default: true })
  canRead!: boolean;

  @Column({ type: 'boolean', name: 'can_update', default: true })
  canUpdate!: boolean;

  @Column({ type: 'boolean', name: 'can_soft_delete', default: true })
  canSoftDelete!: boolean;

  @Column({ type: 'boolean', name: 'can_destroy', default: false })
  canDestroy!: boolean;
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

  @Column({ type: 'boolean', name: 'can_read', default: true })
  canRead!: boolean;

  @Column({ type: 'boolean', name: 'can_update', default: true })
  canUpdate!: boolean;
}
