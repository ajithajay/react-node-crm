import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'users' })
export class UserEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Index({ unique: true })
  @Column({ type: 'varchar' })
  email!: string;

  @Column({ type: 'varchar', name: 'password_hash', nullable: true })
  passwordHash!: string | null;

  @Column({ type: 'varchar', name: 'first_name', default: '' })
  firstName!: string;

  @Column({ type: 'varchar', name: 'last_name', default: '' })
  lastName!: string;

  @Column({ type: 'boolean', name: 'is_email_verified', default: false })
  isEmailVerified!: boolean;

  @Column({ type: 'boolean', default: false })
  disabled!: boolean;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
