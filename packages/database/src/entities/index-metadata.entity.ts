import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'index_metadata' })
export class IndexMetadataEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'object_metadata_id' })
  objectMetadataId!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'boolean', name: 'is_unique', default: false })
  isUnique!: boolean;

  @Column({ type: 'jsonb', name: 'column_names' })
  columnNames!: string[];

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
