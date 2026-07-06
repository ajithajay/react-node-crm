import { Column, CreateDateColumn, Entity, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

@Entity({ name: 'refresh_tokens' })
export class RefreshTokenEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', name: 'token_hash' })
  tokenHash!: string;

  @Column({ type: 'timestamptz', name: 'expires_at' })
  expiresAt!: Date;

  @Column({ type: 'timestamptz', name: 'revoked_at', nullable: true })
  revokedAt!: Date | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;
}

export const TwoFactorMethodStatus = { PENDING: 'PENDING', VERIFIED: 'VERIFIED' } as const;
export type TwoFactorMethodStatus =
  (typeof TwoFactorMethodStatus)[keyof typeof TwoFactorMethodStatus];

@Entity({ name: 'two_factor_methods' })
export class TwoFactorMethodEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'user_id' })
  userId!: string;

  @Column({ type: 'varchar', default: 'TOTP' })
  strategy!: 'TOTP';

  @Column({ type: 'varchar', name: 'secret_ciphertext' })
  secretCiphertext!: string;

  @Column({ type: 'varchar', default: TwoFactorMethodStatus.PENDING })
  status!: TwoFactorMethodStatus;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
