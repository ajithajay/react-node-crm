import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'object_metadata' })
@Index(['workspaceId', 'nameSingular'], { unique: true })
@Index(['workspaceId', 'namePlural'], { unique: true })
export class ObjectMetadataEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  /** snake_case; also the physical table name in the workspace schema. */
  @Column({ type: 'varchar', name: 'name_singular' })
  nameSingular!: string;

  @Column({ type: 'varchar', name: 'name_plural' })
  namePlural!: string;

  @Column({ type: 'varchar', name: 'label_singular' })
  labelSingular!: string;

  @Column({ type: 'varchar', name: 'label_plural' })
  labelPlural!: string;

  @Column({ type: 'varchar', nullable: true })
  icon!: string | null;

  @Column({ type: 'varchar', nullable: true })
  description!: string | null;

  /** The field whose value is the record's display label/title ("Record label"). */
  @Column({ type: 'uuid', name: 'label_identifier_field_metadata_id', nullable: true })
  labelIdentifierFieldMetadataId!: string | null;

  /** The field used as the record's image/avatar ("Record image"). */
  @Column({ type: 'uuid', name: 'image_identifier_field_metadata_id', nullable: true })
  imageIdentifierFieldMetadataId!: string | null;

  /**
   * An OR of AND-groups of `fieldMetadataId`s: two records are flagged as possible duplicates if
   * ALL fields in any one group have equal values on both. `null`/`[]` disables detection for this
   * object. Mirrors Twenty's `duplicateCriteria` (`string[][]`), just keyed by field id instead of
   * physical column name so it survives field renames.
   */
  @Column({ type: 'jsonb', name: 'duplicate_criteria', nullable: true })
  duplicateCriteria!: string[][] | null;

  @Column({ type: 'boolean', name: 'is_custom', default: true })
  isCustom!: boolean;

  @Column({ type: 'boolean', name: 'is_active', default: true })
  isActive!: boolean;

  @Column({ type: 'boolean', name: 'is_system', default: false })
  isSystem!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
