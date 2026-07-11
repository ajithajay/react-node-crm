import { useState } from 'react';
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
import { ApiError, type ImportSummary } from '@/lib/api-client';

export function ImportCsvDialog({ onImport }: { onImport: (file: File) => Promise<ImportSummary> }) {
  const [open, setOpen] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);

  async function handleImport(): Promise<void> {
    if (!file) return;
    setImporting(true);
    setError(null);
    try {
      setSummary(await onImport(file));
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
        if (!next) {
          setFile(null);
          setSummary(null);
          setError(null);
        }
      }}
    >
      <DialogTrigger render={<Button variant="ghost" size="sm" className="h-7 w-full justify-start px-2 text-xs" />}>
        Import CSV
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Import CSV</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">
            Header columns must match the ones produced by Export CSV (composite fields use dotted
            headers, e.g. <code>revenue.amountMicros</code>). Up to 2,000 rows per import.
          </p>
          <div>
            <Label>File</Label>
            <Input type="file" accept=".csv,text/csv" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </div>
          {error && (
            <Alert variant="destructive">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {summary && (
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
        </div>
        <DialogFooter>
          <Button onClick={() => void handleImport()} disabled={!file || importing}>
            Import
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
