import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

export interface FormFieldDef {
  id: string;
  name: string;
  label: string;
  type: string;
}

interface Props {
  fields: FormFieldDef[];
  values: Record<string, unknown>;
  onChange: (values: Record<string, unknown>) => void;
}

/** Renders a FORM step's TEXT/NUMBER/BOOLEAN fields — shared by the public form page and the
 * in-app "Submit" tab on a run's pending FORM step. */
export function FormFields({ fields, values, onChange }: Props) {
  return (
    <>
      {fields.map((f) => (
        <div key={f.id} className="flex flex-col gap-1.5">
          {f.type === 'BOOLEAN' ? (
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={!!values[f.name]}
                onChange={(e) => onChange({ ...values, [f.name]: e.target.checked })}
              />
              {f.label}
            </label>
          ) : (
            <>
              <Label>{f.label}</Label>
              <Input
                type={f.type === 'NUMBER' ? 'number' : 'text'}
                value={String(values[f.name] ?? '')}
                onChange={(e) => onChange({ ...values, [f.name]: e.target.value })}
              />
            </>
          )}
        </div>
      ))}
    </>
  );
}
