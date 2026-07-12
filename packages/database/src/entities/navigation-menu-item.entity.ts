import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

/**
 * A user-customizable left-sidebar entry (Twenty's `navigationMenuItem`). Per workspace member.
 * A FOLDER groups children (which point back via `folderId`); the other types are leaf links to an
 * object list, a saved view, or an external URL. `position` orders siblings.
 */
export const NavigationMenuItemType = {
  FOLDER: 'FOLDER',
  OBJECT: 'OBJECT',
  VIEW: 'VIEW',
  LINK: 'LINK',
} as const;
export type NavigationMenuItemType = (typeof NavigationMenuItemType)[keyof typeof NavigationMenuItemType];

@Entity({ name: 'navigation_menu_items' })
@Index('IDX_navigation_menu_items_member', ['workspaceId', 'workspaceMemberId'])
export class NavigationMenuItemEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'uuid', name: 'workspace_id' })
  workspaceId!: string;

  @Column({ type: 'uuid', name: 'workspace_member_id' })
  workspaceMemberId!: string;

  @Column({ type: 'varchar' })
  type!: NavigationMenuItemType;

  @Column({ type: 'varchar' })
  label!: string;

  @Column({ type: 'varchar', nullable: true })
  icon!: string | null;

  /** Accent color name (from the shared TAG_COLORS palette); null = default (blue). */
  @Column({ type: 'varchar', nullable: true })
  color!: string | null;

  @Column({ type: 'double precision', default: 0 })
  position!: number;

  /** Parent folder (a NavigationMenuItem of type FOLDER); null = top-level. */
  @Column({ type: 'uuid', name: 'folder_id', nullable: true })
  folderId!: string | null;

  @Column({ type: 'uuid', name: 'target_object_metadata_id', nullable: true })
  targetObjectMetadataId!: string | null;

  @Column({ type: 'uuid', name: 'view_id', nullable: true })
  viewId!: string | null;

  @Column({ type: 'varchar', nullable: true })
  link!: string | null;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt!: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt!: Date;
}
