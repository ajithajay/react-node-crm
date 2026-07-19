import { useMemo, useState } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ApiError, type DataModelField, type ImportSummary } from '@/lib/api-client';
import {
  autoMatchTarget,
  buildImportTargetColumns,
  parseCsvClient,
  stringifyCsvClient,
  validateCell,
  type ImportTargetColumn,
} from '../lib/csv-import';

const DONT_IMPORT = '__DONT_IMPORT__';
const MAX_PREVIEW_ROWS = 500;

type Step = 'upload' | 'map' | 'review' | 'result';

interface RowIssue {
  row: number; // 1-indexed data row (matches the server's row numbering convention)
  column: string;
  message: string;
}

export function ImportCsvDialog({
  fields,
  onImport,
}: {
  fields: DataModelField[];
  onImport: (file: File) => Promise<ImportSummary>;
}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [csvRows, setCsvRows] = useState<string[][] | null>(null);
  const [mapping, setMapping] = useState<(string | null)[]>([]); // one target header (or null) per CSV column
  const [skipInvalidRows, setSkipInvalidRows] = useState(true);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  const targets = useMemo(() => buildImportTargetColumns(fields), [fields]);
  const targetByHeader = useMemo(() => new Map(targets.map((t) => [t.header, t])), [targets]);
  const header = csvRows?.[0] ?? [];
  const dataRows = csvRows?.slice(1) ?? [];

  function reset(): void {
    setStep('upload');
    setFile(null);
    setCsvRows(null);
    setMapping([]);
    setSkipInvalidRows(true);
    setSummary(null);
    setError(null);
  }

  async function handleFileSelected(next: File | null): Promise<void> {
    setFile(next);
    if (!next) return;
    const text = await next.text();
    const rows = parseCsvClient(text);
    if (rows.length === 0) {
      setError('That file has no rows.');
      return;
    }
    setCsvRows(rows);
    setMapping(rows[0]!.map((h) => autoMatchTarget(h, targets)?.header ?? null));
    setError(null);
  }

  const issues: RowIssue[] = useMemo(() => {
    const result: RowIssue[] = [];
    dataRows.forEach((row, rowIndex) => {
      mapping.forEach((targetHeader, colIndex) => {
        if (!targetHeader) return;
        const target = targetByHeader.get(targetHeader);
        if (!target) return;
        const message = validateCell(target, row[colIndex] ?? '');
        if (message) result.push({ row: rowIndex + 1, column: header[colIndex] ?? `column ${colIndex + 1}`, message });
      });
    });
    return result;
  }, [dataRows, mapping, targetByHeader, header]);

  const invalidRowNumbers = new Set(issues.map((i) => i.row));

  async function handleConfirmImport(): Promise<void> {
    if (!file || !csvRows) return;
    setImporting(true);
    setError(null);
    try {
      const mappedIndexes = mapping
        .map((targetHeader, colIndex) => ({ targetHeader, colIndex }))
        .filter((m): m is { targetHeader: string; colIndex: number } => m.targetHeader !== null);

      const outHeader = mappedIndexes.map((m) => m.targetHeader);
      const outRows = dataRows
        .filter((_, rowIndex) => !skipInvalidRows || !invalidRowNumbers.has(rowIndex + 1))
        .map((row) => mappedIndexes.map((m) => row[m.colIndex] ?? ''));

      const csvText = stringifyCsvClient([outHeader, ...outRows]);
      const remapped = new File([csvText], file.name, { type: 'text/csv' });
      setSummary(await onImport(remapped));
      setStep('result');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Something went wrong');
    } finally {
      setImporting(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 w-full justify-start px-2 text-xs" />}>
        Import CSV
      </DialogTrigger>
      <DialogContent className={step === 'map' || step === 'review' ? 'max-w-2xl' : undefined}>
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
        </DialogHeader>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {step === 'upload' && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              Pick a CSV file — you'll map its columns to fields on the next step. Up to 2,000 rows per import.
            </p>
            <div>
              <Label>File</Label>
              <Input type="file" accept=".csv,text/csv" onChange={(e) => void handleFileSelected(e.target.files?.[0] ?? null)} />
            </div>
          </div>
        )}

        {step === 'map' && (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Match each column from your file to a field. Columns left as "Don't import" are skipped.
            </p>
            <div className="max-h-96 space-y-2 overflow-y-auto">
              {header.map((csvHeader, colIndex) => (
                <div key={colIndex} className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 text-sm">
                  <div className="truncate">
                    <div className="truncate font-medium">{csvHeader}</div>
                    <div className="truncate text-xs text-muted-foreground">e.g. {dataRows[0]?.[colIndex] || '—'}</div>
                  </div>
                  <span className="text-muted-foreground">→</span>
                  <Select
                    value={mapping[colIndex] ?? DONT_IMPORT}
                    onValueChange={(value) =>
                      setMapping((prev) => prev.map((m, i) => (i === colIndex ? (value === DONT_IMPORT ? null : value) : m)))
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={DONT_IMPORT}>Don't import</SelectItem>
                      {targets.map((t: ImportTargetColumn) => (
                        <SelectItem key={t.header} value={t.header}>
                          {t.fieldLabel}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ))}
            </div>
          </div>
        )}

        {step === 'review' && (
          <div className="space-y-3">
            <p className="text-sm">
              {dataRows.length} row{dataRows.length === 1 ? '' : 's'} found
              {issues.length > 0 && `, ${invalidRowNumbers.size} with issues`}.
            </p>
            {issues.length > 0 && (
              <>
                <div className="max-h-40 space-y-0.5 overflow-y-auto rounded-md border p-2 text-xs">
                  {issues.slice(0, MAX_PREVIEW_ROWS).map((issue, i) => (
                    <div key={i}>
                      Row {issue.row}, {issue.column}: {issue.message}
                    </div>
                  ))}
                </div>
                <div className="flex gap-4 text-sm">
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={skipInvalidRows} onChange={() => setSkipInvalidRows(true)} />
                    Skip rows with issues
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input type="radio" checked={!skipInvalidRows} onChange={() => setSkipInvalidRows(false)} />
                    Import all rows anyway
                  </label>
                </div>
              </>
            )}
          </div>
        )}

        {step === 'result' && summary && (
          <Alert>
            <AlertDescription>
              <p>
                Created {summary.created}, failed {summary.failed}.
              </p>
              {summary.errors.length > 0 && (
                <ul className="mt-2 max-h-32 list-disc space-y-0.5 overflow-y-auto pl-4 text-xs">
                  {summary.errors.map((e, i) => (
                    <li key={i}>
                      Row {e.row}: {e.message}
                    </li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        <DialogFooter>
          {step === 'upload' && (
            <Button onClick={() => setStep('map')} disabled={!csvRows}>
              Next: Map columns
            </Button>
          )}
          {step === 'map' && (
            <>
              <Button variant="ghost" onClick={() => setStep('upload')}>
                Back
              </Button>
              <Button onClick={() => setStep('review')} disabled={mapping.every((m) => m === null)}>
                Next: Review
              </Button>
            </>
          )}
          {step === 'review' && (
            <>
              <Button variant="ghost" onClick={() => setStep('map')}>
                Back
              </Button>
              <Button onClick={() => void handleConfirmImport()} disabled={importing}>
                Import
              </Button>
            </>
          )}
          {step === 'result' && <Button onClick={() => setOpen(false)}>Done</Button>}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
