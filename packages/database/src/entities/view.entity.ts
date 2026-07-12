import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';
import type { ViewFilterOperand, ViewSortDirection, ViewType } from '@saasly/shared';

@Entity({ name: 'views' })
export class ViewEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'object_metadata_id' })
  objectMetadataId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', default: 'TABLE' })
  type!: ViewType;

  @Column({ type: 'varchar', nullable: true })
  icon!: string | null;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'boolean', name: 'is_compact', default: false })
  isCompact!: boolean;

  /** The auto-created "All <Object>" index view — locked from rename/delete (Twenty's ViewKey.INDEX). */
  @Column({ type: 'boolean', name: 'is_default', default: false })
  isDefault!: boolean;

  @Column({ type: 'uuid', name: 'kanban_field_metadata_id', nullable: true })
  kanbanFieldMetadataId!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}

@Entity({ name: 'view_fields' })
@Index(['viewId', 'fieldMetadataId'], { unique: true })
export class ViewFieldEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'view_id' })
  viewId!: string;

  @Column({ type: 'uuid', name: 'field_metadata_id' })
  fieldMetadataId!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @Column({ type: 'boolean', name: 'is_visible', default: true })
  isVisible!: boolean;

  @Column({ type: 'int', default: 150 })
  size!: number;
}

@Entity({ name: 'view_filters' })
export class ViewFilterEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'view_id' })
  viewId!: string;

  @Column({ type: 'uuid', name: 'field_metadata_id' })
  fieldMetadataId!: string;

  @Column({ type: 'varchar' })
  operand!: ViewFilterOperand;

  @Column({ type: 'jsonb', nullable: true })
  value!: unknown;

  @Column({ type: 'int', default: 0 })
  position!: number;
}

@Entity({ name: 'view_sorts' })
@Index(['viewId', 'fieldMetadataId'], { unique: true })
export class ViewSortEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'view_id' })
  viewId!: string;

  @Column({ type: 'uuid', name: 'field_metadata_id' })
  fieldMetadataId!: string;

  @Column({ type: 'varchar', default: 'ASC' })
  direction!: ViewSortDirection;
}

@Entity({ name: 'view_groups' })
export class ViewGroupEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'view_id' })
  viewId!: string;

  @Column({ type: 'uuid', name: 'field_metadata_id' })
  fieldMetadataId!: string;

  @Column({ type: 'varchar', name: 'field_value' })
  fieldValue!: string;

  @Column({ type: 'boolean', name: 'is_visible', default: true })
  isVisible!: boolean;

  @Column({ type: 'int', default: 0 })
  position!: number;
}
