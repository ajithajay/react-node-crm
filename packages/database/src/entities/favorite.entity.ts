import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'favorites' })
@Index(['workspaceMemberId', 'objectMetadataId', 'recordId'], { unique: true })
export class FavoriteEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_member_id' })
  workspaceMemberId!: string;

  @Column({ type: 'uuid', name: 'object_metadata_id' })
  objectMetadataId!: string;

  @Column({ type: 'uuid', name: 'record_id' })
  recordId!: string;

  @Column({ type: 'int', default: 0 })
  position!: number;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
