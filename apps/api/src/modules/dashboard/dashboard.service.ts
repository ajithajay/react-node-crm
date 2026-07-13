import {
  ObjectMetadataEntity,
  PageLayoutEntity,
  PageLayoutTabEntity,
  PageLayoutType,
  PageLayoutWidgetEntity,
} from '@saasly/database';
import type {
  DashboardDetail,
  DashboardSummary,
  DashboardTabDto,
  DashboardWidgetConfiguration,
  DashboardWidgetDto,
  DashboardWidgetType,
  SaveDashboardLayoutRequest,
} from '@saasly/shared';
import { dataSource } from '../../lib/db.js';
import { AppError, NotFoundError } from '../../lib/errors.js';
import * as recordService from '../record/record.service.js';
import type { Principal } from '../record/record-permission.js';
import { record as recordAuditLog } from '../audit-log/audit-log.service.js';

const objectRepo = () => dataSource.getRepository(ObjectMetadataEntity);
const layoutRepo = () => dataSource.getRepository(PageLayoutEntity);
const tabRepo = () => dataSource.getRepository(PageLayoutTabEntity);
const widgetRepo = () => dataSource.getRepository(PageLayoutWidgetEntity);

/** A dashboard record's own object always has this plural name (seeded once per workspace — see
 * `standard-objects.seed.ts`'s `dashboard` def). Reusing the generic record API for the record row
 * itself (create/list/get/update/delete) picks up actor-stamping, webhooks, and permission checks
 * for free — only the page_layout tab/widget tree needs bespoke handling here. */
const DASHBOARD_OBJECT_NAME_PLURAL = 'dashboards';

function actorUserIdOf(principal: Principal): string | null {
  return principal.type === 'user' ? principal.userId : null;
}

function toSummary(record: Record<string, unknown>): DashboardSummary {
  return {
    id: record.id as string,
    title: record.title as string,
    position: (record.position as number) ?? 0,
    updatedAt: String(record.updatedAt),
  };
}

async function loadLayoutTree(workspaceId: string, layoutId: string): Promise<DashboardTabDto[]> {
  const tabs = await tabRepo().find({ where: { workspaceId, pageLayoutId: layoutId }, order: { position: 'ASC' } });
  const tabIds = tabs.map((t) => t.id);
  const widgets = tabIds.length
    ? await widgetRepo()
        .createQueryBuilder('w')
        .where('w.workspace_id = :workspaceId', { workspaceId })
        .andWhere('w.page_layout_tab_id IN (:...tabIds)', { tabIds })
        .orderBy('w.position', 'ASC')
        .getMany()
    : [];

  return tabs.map((tab) => ({
    id: tab.id,
    title: tab.title,
    isVisible: tab.isVisible,
    isPinned: tab.isPinned,
    widgets: widgets
      .filter((w) => w.pageLayoutTabId === tab.id)
      .map(
        (w): DashboardWidgetDto => ({
          id: w.id,
          type: w.type as DashboardWidgetType,
          title: w.title,
          objectMetadataId: w.objectMetadataId,
          isVisible: w.isVisible,
          gridPosition: { row: w.gridRow, column: w.gridColumn, rowSpan: w.gridRowSpan, columnSpan: w.gridColumnSpan },
          configuration: (w.configuration as DashboardWidgetConfiguration) ?? {},
        }),
      ),
  }));
}

export async function listDashboards(workspaceId: string, principal: Principal): Promise<DashboardSummary[]> {
  const result = await recordService.listRecords(workspaceId, principal, DASHBOARD_OBJECT_NAME_PLURAL, {
    page: 1,
    pageSize: 200,
  });
  return result.records.map(toSummary);
}

export async function getDashboard(workspaceId: string, principal: Principal, id: string): Promise<DashboardDetail> {
  const record = await recordService.getRecord(workspaceId, principal, DASHBOARD_OBJECT_NAME_PLURAL, id);
  const pageLayoutId = record.pageLayoutId as string | null;
  if (!pageLayoutId) throw new NotFoundError('Dashboard has no layout');

  const layout = await layoutRepo().findOneBy({ workspaceId, id: pageLayoutId, type: PageLayoutType.DASHBOARD });
  if (!layout) throw new NotFoundError('Dashboard layout not found');

  const tabs = await loadLayoutTree(workspaceId, layout.id);
  return { ...toSummary(record), pageLayoutId: layout.id, tabs };
}

export async function createDashboard(workspaceId: string, principal: Principal, title: string): Promise<DashboardDetail> {
  const layout = await dataSource.transaction(async (m) => {
    const l = await m.getRepository(PageLayoutEntity).save(
      m.getRepository(PageLayoutEntity).create({
        workspaceId,
        objectMetadataId: null,
        type: PageLayoutType.DASHBOARD,
        name: title,
      }),
    );
    await m.getRepository(PageLayoutTabEntity).save(
      m.getRepository(PageLayoutTabEntity).create({
        workspaceId,
        pageLayoutId: l.id,
        title: 'Tab 1',
        position: 0,
        isVisible: true,
        isPinned: true,
      }),
    );
    return l;
  });

  const record = await recordService.createRecord(workspaceId, principal, DASHBOARD_OBJECT_NAME_PLURAL, {
    title,
    pageLayoutId: layout.id,
  });

  await recordAuditLog(workspaceId, actorUserIdOf(principal), 'dashboard.created', { dashboardId: record.id as string });
  return getDashboard(workspaceId, principal, record.id as string);
}

export async function updateDashboard(
  workspaceId: string,
  principal: Principal,
  id: string,
  title: string,
): Promise<DashboardDetail> {
  const record = await recordService.updateRecord(workspaceId, principal, DASHBOARD_OBJECT_NAME_PLURAL, id, { title });
  const pageLayoutId = record.pageLayoutId as string | null;
  if (pageLayoutId) await layoutRepo().update({ workspaceId, id: pageLayoutId }, { name: title });

  await recordAuditLog(workspaceId, actorUserIdOf(principal), 'dashboard.updated', { dashboardId: id });
  return getDashboard(workspaceId, principal, id);
}

export async function deleteDashboard(workspaceId: string, principal: Principal, id: string): Promise<void> {
  const record = await recordService.getRecord(workspaceId, principal, DASHBOARD_OBJECT_NAME_PLURAL, id);
  const pageLayoutId = record.pageLayoutId as string | null;

  await recordService.deleteRecord(workspaceId, principal, DASHBOARD_OBJECT_NAME_PLURAL, id, true);
  if (pageLayoutId) await layoutRepo().delete({ workspaceId, id: pageLayoutId }); // cascades tabs/widgets

  await recordAuditLog(workspaceId, actorUserIdOf(principal), 'dashboard.deleted', { dashboardId: id });
}

export async function saveDashboardLayout(
  workspaceId: string,
  principal: Principal,
  id: string,
  req: SaveDashboardLayoutRequest,
): Promise<DashboardDetail> {
  const record = await recordService.getRecord(workspaceId, principal, DASHBOARD_OBJECT_NAME_PLURAL, id);
  const pageLayoutId = record.pageLayoutId as string | null;
  if (!pageLayoutId) throw new NotFoundError('Dashboard has no layout');

  const objectIds = new Set(
    req.tabs.flatMap((t) => t.widgets.map((w) => w.objectMetadataId).filter((v): v is string => !!v)),
  );
  if (objectIds.size) {
    const activeObjects = await objectRepo().findBy({ workspaceId, isActive: true });
    const activeIds = new Set(activeObjects.map((o) => o.id));
    for (const oid of objectIds) {
      if (!activeIds.has(oid)) throw new AppError('A widget references an object that does not exist', 400);
    }
  }

  await dataSource.transaction(async (m) => {
    // Rebuild the whole tab/widget tree (widgets cascade-delete off their tab).
    await m.getRepository(PageLayoutTabEntity).delete({ workspaceId, pageLayoutId });

    for (let ti = 0; ti < req.tabs.length; ti++) {
      const tabInput = req.tabs[ti]!;
      const tab = await m.getRepository(PageLayoutTabEntity).save(
        m.getRepository(PageLayoutTabEntity).create({
          workspaceId,
          pageLayoutId,
          title: tabInput.title,
          position: ti,
          isVisible: tabInput.isVisible,
          isPinned: tabInput.isPinned,
        }),
      );

      for (let wi = 0; wi < tabInput.widgets.length; wi++) {
        const widgetInput = tabInput.widgets[wi]!;
        await m.getRepository(PageLayoutWidgetEntity).save(
          m.getRepository(PageLayoutWidgetEntity).create({
            workspaceId,
            pageLayoutTabId: tab.id,
            type: widgetInput.type,
            title: widgetInput.title,
            objectMetadataId: widgetInput.objectMetadataId ?? null,
            position: wi,
            gridRow: widgetInput.gridPosition.row,
            gridColumn: widgetInput.gridPosition.column,
            gridRowSpan: widgetInput.gridPosition.rowSpan,
            gridColumnSpan: widgetInput.gridPosition.columnSpan,
            isVisible: widgetInput.isVisible,
            configuration: widgetInput.configuration ?? {},
          }),
        );
      }
    }
  });

  await recordAuditLog(workspaceId, actorUserIdOf(principal), 'dashboard.layout_updated', { dashboardId: id });
  return getDashboard(workspaceId, principal, id);
}
