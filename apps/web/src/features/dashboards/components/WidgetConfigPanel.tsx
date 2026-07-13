import { useState, type ComponentType } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  ArrowUpDown,
  Check,
  ChevronLeft,
  ChevronRight,
  Database,
  Eye,
  EyeOff,
  Filter as FilterIcon,
  Palette,
  Tag,
  Type as TypeIcon,
  Waypoints,
  X,
} from 'lucide-react';
import {
  AGGREGATE_OPERATIONS,
  CHART_ORDER_BY_OPTIONS,
  DATE_GRANULARITIES,
  CHART_NUMBER_FORMATS,
} from '@saasly/shared';
import { dataModelApi, type DashboardWidget, type DashboardWidgetConfiguration, type DataModelField } from '@/lib/api-client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { FilterBar, type FilterCondition } from '@/features/objects/components/FilterBar';
import { CHART_ORDER_BY_LABELS, CHART_QUICK_TYPES, WIDGET_TYPE_ICONS, WIDGET_TYPE_LABELS } from '../lib/widget-defaults';
import { CHART_SERIES_LIGHT, chartSeriesColor } from '../lib/chart-colors';
import { useIsDarkMode } from '../lib/use-is-dark-mode';
import { isDisplayableField } from './RecordTableWidgetView';

const AGGREGATABLE_FIELD_TYPES = new Set(['NUMBER', 'RATING', 'CURRENCY']);
const GROUP_BY_FIELD_TYPES = new Set(['TEXT', 'BOOLEAN', 'SELECT', 'NUMBER', 'RATING', 'DATE', 'DATE_TIME', 'RELATION', 'UUID']);
const DATE_TYPES = new Set(['DATE', 'DATE_TIME']);
const SORTABLE_TYPES = new Set(['TEXT', 'NUMBER', 'BOOLEAN', 'SELECT', 'DATE', 'DATE_TIME', 'RATING', 'UUID']);

interface PickerItem {
  id: string;
  label: string;
}

/** The panel's single-level drill-down destinations. Selecting a row pushes one of these; a header
 * back-chevron always returns to the root row list (Twenty's own nesting rarely goes deeper than
 * one level for these settings, so a flat stack — not a full navigation stack — keeps this tractable). */
type SubView =
  | { kind: 'objectPicker'; title: string; items: PickerItem[]; selectedId: string | null; onSelect: (id: string) => void }
  | { kind: 'fieldPicker'; title: string; items: PickerItem[]; selectedId: string | null; includeNone?: boolean; onSelect: (id: string | null) => void }
  | { kind: 'optionPicker'; title: string; items: PickerItem[]; selectedId: string | null; onSelect: (id: string) => void }
  | { kind: 'filter' }
  | { kind: 'axisName' }
  | { kind: 'colors' }
  | { kind: 'viewFields' };

function Row({
  icon: Icon,
  label,
  value,
  onClick,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  value?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center justify-between gap-2 rounded-md px-2 py-2 text-left text-sm hover:bg-accent"
    >
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </span>
      <span className="flex min-w-0 items-center gap-1">
        {value && <span className="truncate text-foreground">{value}</span>}
        <ChevronRight className="size-3.5 shrink-0 text-muted-foreground" />
      </span>
    </button>
  );
}

function InlineRow({
  icon: Icon,
  label,
  children,
}: {
  icon: ComponentType<{ className?: string }>;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-2 text-sm">
      <span className="flex items-center gap-2 text-muted-foreground">
        <Icon className="size-4 shrink-0" />
        {label}
      </span>
      {children}
    </div>
  );
}

function SubViewHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <div className="flex items-center gap-2 border-b px-2 py-2.5">
      <button type="button" onClick={onBack} className="rounded p-1 hover:bg-accent" aria-label="Back">
        <ChevronLeft className="size-4" />
      </button>
      <span className="text-sm font-medium">{title}</span>
    </div>
  );
}

function PickerList({
  items,
  selectedId,
  includeNone,
  onSelect,
}: {
  items: PickerItem[];
  selectedId: string | null;
  includeNone?: boolean;
  onSelect: (id: string | null) => void;
}) {
  return (
    <div className="flex flex-col overflow-y-auto py-1">
      {includeNone && (
        <button
          type="button"
          onClick={() => onSelect(null)}
          className="flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
        >
          None
          {selectedId === null && <Check className="size-4" />}
        </button>
      )}
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={() => onSelect(item.id)}
          className="flex items-center justify-between px-3 py-2 text-left text-sm hover:bg-accent"
        >
          {item.label}
          {selectedId === item.id && <Check className="size-4" />}
        </button>
      ))}
    </div>
  );
}

/** A right-side, always-visible configuration panel (not a modal Sheet) with Twenty's actual
 * drill-down interaction: most rows show a value preview + chevron and open a full-width sub-view
 * (a searchable/plain list, the filter builder, a color grid, or a text field) rather than an inline
 * select. Toggles and the two range inputs stay inline (no chevron), matching the reference UI. */
export function WidgetConfigPanel({
  widget,
  onClose,
  onUpdate,
}: {
  widget: DashboardWidget;
  onClose: () => void;
  onUpdate: (updater: (w: DashboardWidget) => DashboardWidget) => void;
}) {
  const isDark = useIsDarkMode();
  const [subView, setSubView] = useState<SubView | null>(null);
  const { data: objects } = useQuery({ queryKey: ['data-model-objects'], queryFn: dataModelApi.listObjects });
  const { data: objectDetail } = useQuery({
    queryKey: ['data-model-object', widget.objectMetadataId],
    queryFn: () => dataModelApi.getObject(widget.objectMetadataId!),
    enabled: !!widget.objectMetadataId,
  });
  const fields: DataModelField[] = objectDetail?.fields.filter((f) => f.isActive) ?? [];
  const fieldById = new Map(fields.map((f) => [f.id, f]));

  const config = widget.configuration;
  const isGraph = widget.type === 'GRAPH';
  const needsObject = isGraph || widget.type === 'RECORD_TABLE';
  const graphType = config.configurationType;
  const isAxisChart = graphType === 'BAR_CHART' || graphType === 'LINE_CHART';
  const isPie = graphType === 'PIE_CHART';
  const isAggregate = graphType === 'AGGREGATE_CHART';
  const isHorizontal = graphType === 'BAR_CHART' && config.layout === 'HORIZONTAL';
  const groupByField = fields.find((f) => f.id === config.groupByFieldMetadataId);
  const showGranularity = (isAxisChart || isPie) && groupByField && DATE_TYPES.has(groupByField.type);
  const Icon = WIDGET_TYPE_ICONS[widget.type];

  function patchConfig(next: Partial<DashboardWidgetConfiguration>): void {
    onUpdate((w) => ({ ...w, configuration: { ...w.configuration, ...next } }));
  }

  function setObject(id: string): void {
    onUpdate((w) => ({
      ...w,
      objectMetadataId: id,
      configuration: {
        ...w.configuration,
        aggregateFieldMetadataId: undefined,
        groupByFieldMetadataId: undefined,
        secondaryGroupByFieldMetadataId: undefined,
        visibleFieldIds: undefined,
        sortFieldMetadataId: undefined,
        filter: undefined,
      },
    }));
  }

  function setQuickType(qt: (typeof CHART_QUICK_TYPES)[number]): void {
    patchConfig({ configurationType: qt.graphType, ...(qt.layout ? { layout: qt.layout } : {}) });
  }

  function openSourcePicker(): void {
    setSubView({
      kind: 'objectPicker',
      title: 'Source',
      items: (objects ?? []).map((o) => ({ id: o.id, label: o.labelPlural })),
      selectedId: widget.objectMetadataId,
      onSelect: (id) => {
        setObject(id);
        setSubView(null);
      },
    });
  }

  function openGroupByPicker(key: 'groupByFieldMetadataId' | 'secondaryGroupByFieldMetadataId', title: string, includeNone: boolean): void {
    setSubView({
      kind: 'fieldPicker',
      title,
      items: fields.filter((f) => GROUP_BY_FIELD_TYPES.has(f.type) && f.id !== config[key === 'groupByFieldMetadataId' ? 'secondaryGroupByFieldMetadataId' : 'groupByFieldMetadataId']).map((f) => ({ id: f.id, label: f.label })),
      selectedId: config[key] ?? null,
      includeNone,
      onSelect: (id) => {
        patchConfig({ [key]: id ?? undefined });
        setSubView(null);
      },
    });
  }

  function openAggregateFieldPicker(): void {
    setSubView({
      kind: 'fieldPicker',
      title: 'Field',
      items: fields.filter((f) => AGGREGATABLE_FIELD_TYPES.has(f.type)).map((f) => ({ id: f.id, label: f.label })),
      selectedId: config.aggregateFieldMetadataId ?? null,
      onSelect: (id) => {
        patchConfig({ aggregateFieldMetadataId: id ?? undefined });
        setSubView(null);
      },
    });
  }

  function openAggregateOperationPicker(): void {
    setSubView({
      kind: 'optionPicker',
      title: 'Data on display',
      items: AGGREGATE_OPERATIONS.map((op) => ({ id: op, label: op === 'COUNT' ? 'Count all' : op })),
      selectedId: config.aggregateOperation ?? 'COUNT',
      onSelect: (op) => {
        const operation = op as DashboardWidgetConfiguration['aggregateOperation'];
        if (operation === 'COUNT') {
          patchConfig({ aggregateOperation: operation, aggregateFieldMetadataId: undefined });
          setSubView(null);
        } else {
          patchConfig({ aggregateOperation: operation });
          openAggregateFieldPicker();
        }
      },
    });
  }

  function openSortByPicker(): void {
    setSubView({
      kind: 'optionPicker',
      title: 'Sort by',
      items: CHART_ORDER_BY_OPTIONS.map((o) => ({ id: o, label: CHART_ORDER_BY_LABELS[o] })),
      selectedId: config.orderBy ?? 'VALUE_DESC',
      onSelect: (o) => {
        patchConfig({ orderBy: o as DashboardWidgetConfiguration['orderBy'] });
        setSubView(null);
      },
    });
  }

  function openGranularityPicker(key: 'dateGranularity' | 'secondaryDateGranularity'): void {
    setSubView({
      kind: 'optionPicker',
      title: 'Granularity',
      items: DATE_GRANULARITIES.map((g) => ({ id: g, label: g.charAt(0) + g.slice(1).toLowerCase() })),
      selectedId: config[key] ?? 'MONTH',
      onSelect: (g) => {
        patchConfig({ [key]: g });
        setSubView(null);
      },
    });
  }

  function openNumberFormatPicker(): void {
    setSubView({
      kind: 'optionPicker',
      title: 'Number format',
      items: CHART_NUMBER_FORMATS.map((f) => ({ id: f, label: f === 'SHORT' ? 'Short (1.2K)' : 'Full (1,234)' })),
      selectedId: config.numberFormat ?? 'FULL',
      onSelect: (f) => {
        patchConfig({ numberFormat: f as DashboardWidgetConfiguration['numberFormat'] });
        setSubView(null);
      },
    });
  }

  function openViewSortFieldPicker(): void {
    setSubView({
      kind: 'fieldPicker',
      title: 'Sort',
      items: fields.filter((f) => SORTABLE_TYPES.has(f.type)).map((f) => ({ id: f.id, label: f.label })),
      selectedId: config.sortFieldMetadataId ?? null,
      includeNone: true,
      onSelect: (id) => {
        if (!id) {
          patchConfig({ sortFieldMetadataId: undefined });
          setSubView(null);
          return;
        }
        patchConfig({ sortFieldMetadataId: id });
        setSubView({
          kind: 'optionPicker',
          title: 'Direction',
          items: [
            { id: 'ASC', label: 'Ascending' },
            { id: 'DESC', label: 'Descending' },
          ],
          selectedId: config.sortDirection ?? 'ASC',
          onSelect: (dir) => {
            patchConfig({ sortDirection: dir as DashboardWidgetConfiguration['sortDirection'] });
            setSubView(null);
          },
        });
      },
    });
  }

  const filterConditions = (config.filter as FilterCondition[] | undefined) ?? [];
  const aggregateValueLabel = (() => {
    const op = config.aggregateOperation ?? 'COUNT';
    if (op === 'COUNT') return 'Count all';
    const f = config.aggregateFieldMetadataId ? fieldById.get(config.aggregateFieldMetadataId) : undefined;
    return `${f?.label ?? '—'} (${op})`;
  })();

  // ---- Sub-view render ----
  if (subView) {
    if (subView.kind === 'objectPicker' || subView.kind === 'optionPicker') {
      return (
        <div className="flex h-full w-80 shrink-0 flex-col border-l bg-background">
          <SubViewHeader title={subView.title} onBack={() => setSubView(null)} />
          <PickerList items={subView.items} selectedId={subView.selectedId} onSelect={(id) => id && subView.onSelect(id)} />
        </div>
      );
    }
    if (subView.kind === 'fieldPicker') {
      return (
        <div className="flex h-full w-80 shrink-0 flex-col border-l bg-background">
          <SubViewHeader title={subView.title} onBack={() => setSubView(null)} />
          <PickerList items={subView.items} selectedId={subView.selectedId} includeNone={subView.includeNone} onSelect={subView.onSelect} />
        </div>
      );
    }
    if (subView.kind === 'filter') {
      return (
        <div className="flex h-full w-80 shrink-0 flex-col border-l bg-background">
          <SubViewHeader title="Filter" onBack={() => setSubView(null)} />
          <div className="overflow-y-auto p-3">
            <FilterBar fields={fields} conditions={filterConditions} onChange={(next) => patchConfig({ filter: next })} />
          </div>
        </div>
      );
    }
    if (subView.kind === 'axisName') {
      return (
        <div className="flex h-full w-80 shrink-0 flex-col border-l bg-background">
          <SubViewHeader title="Axis name" onBack={() => setSubView(null)} />
          <div className="p-3">
            <Input
              autoFocus
              value={config.axisName ?? ''}
              onChange={(e) => patchConfig({ axisName: e.target.value || null })}
              placeholder="None"
            />
          </div>
        </div>
      );
    }
    if (subView.kind === 'colors') {
      return (
        <div className="flex h-full w-80 shrink-0 flex-col border-l bg-background">
          <SubViewHeader title="Colors" onBack={() => setSubView(null)} />
          <div className="grid grid-cols-4 gap-3 p-3">
            {CHART_SERIES_LIGHT.map((_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => patchConfig({ colorSeed: i })}
                className={`flex size-10 items-center justify-center rounded-full ${(config.colorSeed ?? 0) === i ? 'ring-2 ring-offset-2 ring-primary' : ''}`}
                style={{ backgroundColor: chartSeriesColor(i, isDark) }}
                aria-label={`Color ${i + 1}`}
              >
                {(config.colorSeed ?? 0) === i && <Check className="size-4 text-white" />}
              </button>
            ))}
          </div>
        </div>
      );
    }
    if (subView.kind === 'viewFields') {
      const displayable = fields.filter(isDisplayableField);
      const visible = config.visibleFieldIds ?? displayable.map((f) => f.id);
      return (
        <div className="flex h-full w-80 shrink-0 flex-col border-l bg-background">
          <SubViewHeader title="Fields" onBack={() => setSubView(null)} />
          <div className="flex flex-col gap-1 overflow-y-auto p-2">
            {displayable.map((f) => (
              <label key={f.id} className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                <Checkbox
                  checked={visible.includes(f.id)}
                  onCheckedChange={(c) => {
                    const next = c ? [...new Set([...visible, f.id])] : visible.filter((id) => id !== f.id);
                    patchConfig({ visibleFieldIds: next });
                  }}
                />
                {f.label}
              </label>
            ))}
          </div>
        </div>
      );
    }
  }

  // ---- Root row list ----
  return (
    <div className="flex h-full w-80 shrink-0 flex-col border-l bg-background">
      <div className="flex items-center gap-2 border-b px-3 py-2.5">
        <Icon className="size-4 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-medium">{widget.title}</div>
          <div className="text-xs text-muted-foreground">{WIDGET_TYPE_LABELS[widget.type]}</div>
        </div>
        <Button variant="ghost" size="icon-xs" onClick={onClose} aria-label="Close">
          <X className="size-4" />
        </Button>
      </div>

      {isGraph && (
        <div className="flex gap-1 border-b p-2">
          {CHART_QUICK_TYPES.map((qt) => {
            const active = qt.graphType === graphType && (qt.graphType !== 'BAR_CHART' || (config.layout ?? 'VERTICAL') === qt.layout);
            const QIcon = qt.icon;
            return (
              <button
                key={qt.key}
                type="button"
                title={qt.label}
                onClick={() => setQuickType(qt)}
                className={`flex flex-1 items-center justify-center rounded-md border py-1.5 ${active ? 'border-primary bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent'}`}
              >
                <QIcon className="size-4" />
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="px-1 py-2">
          <Input
            value={widget.title}
            onChange={(e) => onUpdate((w) => ({ ...w, title: e.target.value }))}
            className="h-8 text-sm font-medium"
          />
        </div>

        {(needsObject || isGraph) && <div className="px-2 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Data</div>}

        {needsObject && <Row icon={Database} label="Source" value={objects?.find((o) => o.id === widget.objectMetadataId)?.labelPlural} onClick={openSourcePicker} />}
        {needsObject && widget.objectMetadataId && (
          <Row icon={FilterIcon} label="Filter" value={filterConditions.length ? `${filterConditions.length} rule${filterConditions.length > 1 ? 's' : ''}` : undefined} onClick={() => setSubView({ kind: 'filter' })} />
        )}

        {isAggregate && <Row icon={ArrowUpDown} label="Data on display" value={aggregateValueLabel} onClick={openAggregateOperationPicker} />}

        {isPie && (
          <>
            <Row icon={ArrowUpDown} label="Data on display" value={groupByField?.label} onClick={() => openGroupByPicker('groupByFieldMetadataId', 'Data on display', false)} />
            {showGranularity && <Row icon={ArrowUpDown} label="Granularity" value={config.dateGranularity ?? 'MONTH'} onClick={() => openGranularityPicker('dateGranularity')} />}
            <Row icon={Waypoints} label="Each slice represents" value={aggregateValueLabel} onClick={openAggregateOperationPicker} />
            <Row icon={ArrowUpDown} label="Sort by" value={CHART_ORDER_BY_LABELS[config.orderBy ?? 'VALUE_DESC']} onClick={openSortByPicker} />
            <InlineRow icon={EyeOff} label="Hide empty category">
              <Switch checked={!!config.hideEmptyCategory} onCheckedChange={(c) => patchConfig({ hideEmptyCategory: c })} />
            </InlineRow>
          </>
        )}

        {isAxisChart && (
          <>
            <div className="px-2 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{isHorizontal ? 'Y axis' : 'X axis'}</div>
            <Row icon={ArrowUpDown} label="Data on display" value={groupByField?.label} onClick={() => openGroupByPicker('groupByFieldMetadataId', 'Data on display', false)} />
            {showGranularity && <Row icon={ArrowUpDown} label="Granularity" value={config.dateGranularity ?? 'MONTH'} onClick={() => openGranularityPicker('dateGranularity')} />}
            <Row icon={ArrowUpDown} label="Sort by" value={CHART_ORDER_BY_LABELS[config.orderBy ?? 'VALUE_DESC']} onClick={openSortByPicker} />
            <InlineRow icon={EyeOff} label="Omit zero values">
              <Switch checked={!!config.omitZeroValues} onCheckedChange={(c) => patchConfig({ omitZeroValues: c })} />
            </InlineRow>

            <div className="px-2 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">{isHorizontal ? 'X axis' : 'Y axis'}</div>
            <Row icon={ArrowUpDown} label="Data on display" value={aggregateValueLabel} onClick={openAggregateOperationPicker} />
            <Row
              icon={Waypoints}
              label="Group by"
              value={config.secondaryGroupByFieldMetadataId ? fieldById.get(config.secondaryGroupByFieldMetadataId)?.label : 'None'}
              onClick={() => openGroupByPicker('secondaryGroupByFieldMetadataId', 'Group by', true)}
            />
            <InlineRow icon={ArrowUpDown} label="Min range">
              <Input
                type="number"
                placeholder="Min"
                className="h-8 w-24"
                value={config.rangeMin ?? ''}
                onChange={(e) => patchConfig({ rangeMin: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </InlineRow>
            <InlineRow icon={ArrowUpDown} label="Max range">
              <Input
                type="number"
                placeholder="Max"
                className="h-8 w-24"
                value={config.rangeMax ?? ''}
                onChange={(e) => patchConfig({ rangeMax: e.target.value === '' ? null : Number(e.target.value) })}
              />
            </InlineRow>
          </>
        )}

        {widget.type === 'IFRAME' && (
          <>
            <div className="px-2 pt-2 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Data</div>
            <InlineRow icon={TypeIcon} label="URL">
              <Input className="h-8 w-40" value={config.url ?? ''} onChange={(e) => patchConfig({ url: e.target.value })} placeholder="https://…" />
            </InlineRow>
          </>
        )}

        {widget.type === 'RECORD_TABLE' && widget.objectMetadataId && (
          <>
            <Row
              icon={Database}
              label="Fields"
              value={`${(config.visibleFieldIds ?? fields.filter(isDisplayableField).map((f) => f.id)).length} shown`}
              onClick={() => setSubView({ kind: 'viewFields' })}
            />
            <Row
              icon={ArrowUpDown}
              label="Sort"
              value={config.sortFieldMetadataId ? `${fieldById.get(config.sortFieldMetadataId)?.label} ${config.sortDirection === 'DESC' ? '↓' : '↑'}` : 'None'}
              onClick={openViewSortFieldPicker}
            />
            <InlineRow icon={ArrowUpDown} label="Limit">
              <Input
                type="number"
                min={1}
                max={100}
                className="h-8 w-20"
                value={config.recordLimit ?? 10}
                onChange={(e) => patchConfig({ recordLimit: Number(e.target.value) || 10 })}
              />
            </InlineRow>
          </>
        )}

        {(isAxisChart || isPie || isAggregate) && (
          <>
            <div className="px-2 pt-3 pb-1 text-xs font-medium tracking-wide text-muted-foreground uppercase">Style</div>
            <Row icon={Palette} label="Colors" value={config.colorSeed ? 'Custom' : 'Auto'} onClick={() => setSubView({ kind: 'colors' })} />
            {isAxisChart && <Row icon={TypeIcon} label="Axis name" value={config.axisName ?? 'None'} onClick={() => setSubView({ kind: 'axisName' })} />}
            {(isAxisChart || isPie) && (
              <InlineRow icon={Tag} label="Data labels">
                <Switch checked={!!config.displayDataLabel} onCheckedChange={(c) => patchConfig({ displayDataLabel: c })} />
              </InlineRow>
            )}
            {isPie && (
              <>
                <InlineRow icon={Eye} label="Legend">
                  <Switch checked={config.displayLegend ?? true} onCheckedChange={(c) => patchConfig({ displayLegend: c })} />
                </InlineRow>
                <InlineRow icon={Eye} label="Show value in center">
                  <Switch checked={config.showCenterMetric ?? true} onCheckedChange={(c) => patchConfig({ showCenterMetric: c })} />
                </InlineRow>
              </>
            )}
            {isAggregate && (
              <>
                <Row icon={TypeIcon} label="Number format" value={config.numberFormat === 'SHORT' ? 'Short (1.2K)' : 'Full (1,234)'} onClick={openNumberFormatPicker} />
                <InlineRow icon={TypeIcon} label="Prefix">
                  <Input className="h-8 w-20" value={config.prefix ?? ''} onChange={(e) => patchConfig({ prefix: e.target.value })} placeholder="$" />
                </InlineRow>
                <InlineRow icon={TypeIcon} label="Suffix">
                  <Input className="h-8 w-20" value={config.suffix ?? ''} onChange={(e) => patchConfig({ suffix: e.target.value })} placeholder="%" />
                </InlineRow>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
