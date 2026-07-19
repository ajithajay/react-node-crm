import type { EntityManager } from 'typeorm';
import type { ObjectMetadataEntity } from '../entities/object-metadata.entity.js';
import { FieldMetadataEntity } from '../entities/field-metadata.entity.js';
import { PageLayoutEntity, PageLayoutType } from '../entities/page-layout.entity.js';
import { PageLayoutTabEntity } from '../entities/page-layout-tab.entity.js';
import { PageLayoutWidgetEntity, PageLayoutWidgetType } from '../entities/page-layout-widget.entity.js';
import { quoteIdent } from '../ddl/identifier.util.js';

interface SeedInitialDashboardObjects {
  dashboard: ObjectMetadataEntity;
  company: ObjectMetadataEntity;
  opportunity: ObjectMetadataEntity;
}

interface WidgetSeed {
  type: (typeof PageLayoutWidgetType)[keyof typeof PageLayoutWidgetType];
  title: string;
  objectMetadataId: string | null;
  configuration: Record<string, unknown>;
  grid: { row: number; column: number; rowSpan: number; columnSpan: number };
}

/**
 * Seeds "My First Dashboard" on workspace provisioning, demonstrating every Phase 7
 * widget type over the Opportunity/Company objects: a rich-text welcome, all four GRAPH sub-types
 * (pie/bar/line/aggregate), an IFRAME, and a RECORD_TABLE ("View") widget.
 *
 * The `dashboard` object's own record lives in the *workspace* schema (like any other object), while
 * the page_layout/tab/widget tree lives in `core` — both reachable through the same Postgres
 * connection/transaction, so a raw INSERT against the workspace-schema table is used instead of
 * spinning up a second dynamic-entity DataSource just for this one seed row.
 */
export async function seedInitialDashboard(
  manager: EntityManager,
  workspaceId: string,
  schemaName: string,
  objects: SeedInitialDashboardObjects,
): Promise<void> {
  const fieldRepo = manager.getRepository(FieldMetadataEntity);
  const [opportunityFields, companyFields] = await Promise.all([
    fieldRepo.findBy({ workspaceId, objectMetadataId: objects.opportunity.id }),
    fieldRepo.findBy({ workspaceId, objectMetadataId: objects.company.id }),
  ]);
  const opportunityFieldByName = new Map(opportunityFields.map((f) => [f.name, f]));
  const companyFieldByName = new Map(companyFields.map((f) => [f.name, f]));

  const amountField = opportunityFieldByName.get('amount')!;
  const stageField = opportunityFieldByName.get('stage')!;
  const closeDateField = opportunityFieldByName.get('close_date')!;
  const companyRelationField = opportunityFieldByName.get('company')!;
  void companyFieldByName; // reserved for a future company-scoped widget

  const widgets: WidgetSeed[] = [
    {
      type: PageLayoutWidgetType.STANDALONE_RICH_TEXT,
      title: 'Welcome',
      objectMetadataId: null,
      configuration: {
        // BlockNote needs real `blocknote` partial blocks to render initial content — a bare
        // `markdown` string is display-only (kept alongside for the CSV/API-facing plain-text view).
        blocknote: [
          { type: 'heading', props: { level: 1 }, content: 'Welcome to your first dashboard' },
          {
            type: 'paragraph',
            content:
              'This dashboard shows live charts, an embedded view, and an iframe over your ' +
              'Opportunities data. Click Edit to add, move, resize, or reconfigure any widget.',
          },
        ],
        markdown:
          '# Welcome to your first dashboard\n\nThis dashboard shows live charts, an embedded view, ' +
          'and an iframe over your Opportunities data. Click Edit to add, move, resize, or ' +
          'reconfigure any widget.',
      },
      grid: { row: 0, column: 0, rowSpan: 4, columnSpan: 6 },
    },
    {
      type: PageLayoutWidgetType.GRAPH,
      title: 'Deals by Company',
      objectMetadataId: objects.opportunity.id,
      configuration: {
        configurationType: 'PIE_CHART',
        aggregateFieldMetadataId: null,
        aggregateOperation: 'COUNT',
        groupByFieldMetadataId: companyRelationField.id,
      },
      grid: { row: 0, column: 6, rowSpan: 4, columnSpan: 6 },
    },
    {
      type: PageLayoutWidgetType.GRAPH,
      title: 'Pipeline Value by Stage',
      objectMetadataId: objects.opportunity.id,
      configuration: {
        configurationType: 'BAR_CHART',
        aggregateFieldMetadataId: amountField.id,
        aggregateOperation: 'SUM',
        groupByFieldMetadataId: stageField.id,
        layout: 'VERTICAL',
      },
      grid: { row: 4, column: 0, rowSpan: 6, columnSpan: 6 },
    },
    {
      type: PageLayoutWidgetType.GRAPH,
      title: 'Revenue Over Time',
      objectMetadataId: objects.opportunity.id,
      configuration: {
        configurationType: 'LINE_CHART',
        aggregateFieldMetadataId: amountField.id,
        aggregateOperation: 'SUM',
        groupByFieldMetadataId: closeDateField.id,
        dateGranularity: 'MONTH',
      },
      grid: { row: 10, column: 0, rowSpan: 6, columnSpan: 6 },
    },
    {
      type: PageLayoutWidgetType.GRAPH,
      title: 'Total Open Deals',
      objectMetadataId: objects.opportunity.id,
      configuration: { configurationType: 'AGGREGATE_CHART', aggregateFieldMetadataId: null, aggregateOperation: 'COUNT' },
      grid: { row: 4, column: 6, rowSpan: 3, columnSpan: 3 },
    },
    {
      type: PageLayoutWidgetType.GRAPH,
      title: 'Total Pipeline Value',
      objectMetadataId: objects.opportunity.id,
      configuration: {
        configurationType: 'AGGREGATE_CHART',
        aggregateFieldMetadataId: amountField.id,
        aggregateOperation: 'SUM',
        prefix: '$',
      },
      grid: { row: 4, column: 9, rowSpan: 3, columnSpan: 3 },
    },
    {
      type: PageLayoutWidgetType.IFRAME,
      title: 'Market News',
      objectMetadataId: null,
      configuration: { url: 'https://www.tradingview.com/embed-widget/hotlists/?locale=en' },
      grid: { row: 7, column: 6, rowSpan: 3, columnSpan: 6 },
    },
    {
      type: PageLayoutWidgetType.RECORD_TABLE,
      title: 'Open Opportunities',
      objectMetadataId: objects.opportunity.id,
      configuration: { objectMetadataId: objects.opportunity.id, viewId: null, recordLimit: 10 },
      grid: { row: 16, column: 0, rowSpan: 6, columnSpan: 12 },
    },
  ];

  const layout = await manager.getRepository(PageLayoutEntity).save(
    manager.getRepository(PageLayoutEntity).create({
      workspaceId,
      objectMetadataId: null,
      type: PageLayoutType.DASHBOARD,
      name: 'My First Dashboard',
    }),
  );

  const tab = await manager.getRepository(PageLayoutTabEntity).save(
    manager.getRepository(PageLayoutTabEntity).create({
      workspaceId,
      pageLayoutId: layout.id,
      title: 'Tab 1',
      position: 0,
      isVisible: true,
      isPinned: true,
    }),
  );

  await manager.getRepository(PageLayoutWidgetEntity).save(
    widgets.map((w, i) =>
      manager.getRepository(PageLayoutWidgetEntity).create({
        workspaceId,
        pageLayoutTabId: tab.id,
        type: w.type,
        title: w.title,
        objectMetadataId: w.objectMetadataId,
        position: i,
        gridRow: w.grid.row,
        gridColumn: w.grid.column,
        gridRowSpan: w.grid.rowSpan,
        gridColumnSpan: w.grid.columnSpan,
        isVisible: true,
        configuration: w.configuration,
      }),
    ),
  );

  await manager.query(
    `INSERT INTO ${quoteIdent(schemaName)}.${quoteIdent(objects.dashboard.namePlural)}
       ("title", "page_layout_id", "position", "created_by_source", "created_by_name", "updated_by_source", "updated_by_name")
     VALUES ($1, $2, 0, 'SYSTEM', 'System', 'SYSTEM', 'System')`,
    ['My First Dashboard', layout.id],
  );
}
