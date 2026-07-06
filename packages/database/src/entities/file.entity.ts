import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn } from 'typeorm';

@Entity({ name: 'files' })
export class FileEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'varchar' })
  path!: string;

  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'varchar', name: 'mime_type', nullable: true })
  mimeType!: string | null;

  @Column({ type: 'int', nullable: true })
  size!: number | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}
