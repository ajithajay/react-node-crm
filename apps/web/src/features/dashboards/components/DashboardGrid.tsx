import GridLayoutImport, { useContainerWidth, type Layout, type LayoutItem } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import { useRef, useState, type ReactNode } from 'react';
import type { DashboardWidget, GridPosition } from '@/lib/api-client';
import { DASHBOARD_GRID_COLUMNS, DASHBOARD_GRID_MARGIN, DASHBOARD_GRID_ROW_HEIGHT } from '../lib/widget-defaults';

// react-grid-layout's default export is the non-responsive GridLayout component.
const GridLayout = GridLayoutImport;

/** Extra empty rows always kept clickable below the lowest occupied widget, so there's always room
 * to drag-select a new widget's area even when the grid is otherwise short (Twenty parity). */
const EXTRA_EMPTY_ROWS = 6;
const MIN_TOTAL_ROWS = 10;

function toLayoutItem(widget: DashboardWidget): LayoutItem {
  return {
    i: widget.id,
    x: widget.gridPosition.column,
    y: widget.gridPosition.row,
    w: widget.gridPosition.columnSpan,
    h: widget.gridPosition.rowSpan,
    minW: 2,
    minH: 2,
  };
}

interface Cell {
  row: number;
  col: number;
}

function rectFrom(a: Cell, b: Cell): GridPosition {
  return {
    row: Math.min(a.row, b.row),
    column: Math.min(a.col, b.col),
    rowSpan: Math.abs(a.row - b.row) + 1,
    columnSpan: Math.abs(a.col - b.col) + 1,
  };
}

export function DashboardGrid({
  widgets,
  editMode,
  onLayoutChange,
  onAreaSelected,
  renderWidget,
}: {
  widgets: DashboardWidget[];
  editMode: boolean;
  onLayoutChange: (positions: Map<string, GridPosition>) => void;
  /** Called when the user clicks (or drags a rectangle over) empty grid space to place a new widget
   * there (Twenty parity — "grid selection before creating a widget"). A plain click reports a 1×1
   * `GridPosition`; the caller should apply the widget type's own default size in that case and only
   * honor the exact drawn rectangle when the user actually dragged across more than one cell. */
  onAreaSelected: (position: GridPosition) => void;
  renderWidget: (widget: DashboardWidget) => ReactNode;
}) {
  const { width, containerRef, mounted } = useContainerWidth();
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [dragStart, setDragStart] = useState<Cell | null>(null);
  const [dragCurrent, setDragCurrent] = useState<Cell | null>(null);
  const layout: Layout = widgets.map(toLayoutItem);

  function handleLayoutChange(next: Layout): void {
    const positions = new Map<string, GridPosition>();
    for (const item of next) {
      positions.set(item.i, { row: item.y, column: item.x, rowSpan: item.h, columnSpan: item.w });
    }
    onLayoutChange(positions);
  }

  const occupied = new Set<string>();
  let maxOccupiedRow = 0;
  for (const w of widgets) {
    const { row, column, rowSpan, columnSpan } = w.gridPosition;
    maxOccupiedRow = Math.max(maxOccupiedRow, row + rowSpan);
    for (let r = row; r < row + rowSpan; r++) {
      for (let c = column; c < column + columnSpan; c++) occupied.add(`${r}-${c}`);
    }
  }
  const totalRows = Math.max(MIN_TOTAL_ROWS, maxOccupiedRow + EXTRA_EMPTY_ROWS);

  const colWidth = width ? (width - DASHBOARD_GRID_MARGIN * (DASHBOARD_GRID_COLUMNS + 1)) / DASHBOARD_GRID_COLUMNS : 0;
  const step = DASHBOARD_GRID_ROW_HEIGHT + DASHBOARD_GRID_MARGIN;

  function cellStyle(row: number, col: number): React.CSSProperties {
    return {
      position: 'absolute',
      left: col * (colWidth + DASHBOARD_GRID_MARGIN),
      top: row * step,
      width: colWidth,
      height: DASHBOARD_GRID_ROW_HEIGHT,
    };
  }

  function handleCellMouseDown(cell: Cell): void {
    setDragStart(cell);
    setDragCurrent(cell);

    function onUp(): void {
      window.removeEventListener('mouseup', onUp);
      setDragStart((start) => {
        setDragCurrent((current) => {
          if (start && current) onAreaSelected(rectFrom(start, current));
          return null;
        });
        return null;
      });
    }
    window.addEventListener('mouseup', onUp);
  }

  function handleCellMouseEnter(cell: Cell): void {
    if (dragStart) setDragCurrent(cell);
  }

  const selectionRect = dragStart && dragCurrent ? rectFrom(dragStart, dragCurrent) : null;
  function isInSelection(row: number, col: number): boolean {
    if (!selectionRect) return false;
    return (
      row >= selectionRect.row &&
      row < selectionRect.row + selectionRect.rowSpan &&
      col >= selectionRect.column &&
      col < selectionRect.column + selectionRect.columnSpan
    );
  }

  const emptyCells: Cell[] = [];
  if (editMode) {
    for (let r = 0; r < totalRows; r++) {
      for (let c = 0; c < DASHBOARD_GRID_COLUMNS; c++) {
        if (!occupied.has(`${r}-${c}`)) emptyCells.push({ row: r, col: c });
      }
    }
  }

  return (
    <div ref={containerRef} className="w-full">
      {mounted && (
        <div
          ref={gridRef}
          className="relative"
          style={{ minHeight: editMode ? totalRows * step : undefined }}
        >
          {editMode &&
            emptyCells.map(({ row, col }) => (
              <div
                key={`${row}-${col}`}
                style={cellStyle(row, col)}
                onMouseDown={() => handleCellMouseDown({ row, col })}
                onMouseEnter={() => handleCellMouseEnter({ row, col })}
                className={`rounded-sm border transition-colors ${
                  isInSelection(row, col) ? 'border-primary bg-primary/10' : 'border-dashed border-muted-foreground/15 hover:bg-accent/40'
                }`}
              />
            ))}
          <GridLayout
            width={width}
            layout={layout}
            gridConfig={{ cols: DASHBOARD_GRID_COLUMNS, rowHeight: DASHBOARD_GRID_ROW_HEIGHT, margin: [DASHBOARD_GRID_MARGIN, DASHBOARD_GRID_MARGIN] }}
            dragConfig={{ enabled: editMode, handle: '.drag-handle' }}
            resizeConfig={{ enabled: editMode, handles: ['se'] }}
            onLayoutChange={handleLayoutChange}
          >
            {widgets.map((widget) => (
              <div key={widget.id} data-dashboard-widget="" className="relative z-10">
                {renderWidget(widget)}
              </div>
            ))}
          </GridLayout>
        </div>
      )}
    </div>
  );
}
