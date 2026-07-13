import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { FieldMetadataSettings, FieldMetadataType } from '@saasly/shared';

@Entity({ name: 'field_metadata' })
@Index(['workspaceId', 'objectMetadataId', 'name'], { unique: true })
export class FieldMetadataEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'object_metadata_id' })
  objectMetadataId!: string;

  /** snake_case; also the physical column-name prefix in the workspace table. */
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar' })
  label!: string;

  @Column({ type: 'varchar' })
  type!: FieldMetadataType;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  @Column({ type: 'varchar', nullable: true })
  icon!: string | null;

  @Column({ type: 'boolean', name: 'is_custom', default: true })
  isCustom!: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', name: 'is_system', default: false })
  isSystem!: boolean;

  @Column({ type: 'boolean', name: 'is_nullable', default: true })
  isNullable!: boolean;

  @Column({ type: 'boolean', name: 'is_unique', default: false })
  isUnique!: boolean;

  /** False for a handful of always-on audit fields (created/updated/deleted at) — can't be permission-restricted. */
  @Column({ type: 'boolean', name: 'is_restrictable', default: true })
  isRestrictable!: boolean;

  /** Settings → Layout (BRD §7.2): hides a field from a record's Overview tab without deactivating it. */
  @Column({ type: 'boolean', name: 'is_visible_in_record_page', default: true })
  isVisibleInRecordPage!: boolean;

  /** Declaration order within the object; also the default table-column order. */
  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'jsonb', name: 'default_value', nullable: true })
  defaultValue!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  settings!: FieldMetadataSettings | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
