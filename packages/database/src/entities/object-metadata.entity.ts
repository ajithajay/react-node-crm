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
