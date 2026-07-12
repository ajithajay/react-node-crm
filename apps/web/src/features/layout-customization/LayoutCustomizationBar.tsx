import { Paintbrush } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLayoutCustomization } from './LayoutCustomizationContext';

/** Global overlay shown while sidebar/record-page customization is active (Twenty parity). */
export function LayoutCustomizationBar() {
  const { isActive, isDirty, isSaving, pageLayout, save, cancel } = useLayoutCustomization();
  if (!isActive) return null;

  const title = pageLayout ? `${pageLayout.objectLabel} layout edition` : 'Layout customization';

  return (
    <div className="flex h-10 shrink-0 items-center justify-between bg-blue-600 px-4 text-sm text-white">
      <div className="flex items-center gap-2">
        <Paintbrush className="size-4" />
        <span>{title}</span>
      </div>
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="text-white hover:bg-blue-700 hover:text-white" onClick={cancel}>
          Cancel
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={!isDirty || isSaving}
          onClick={() => void save()}
        >
          Save
        </Button>
      </div>
    </div>
  );
}
