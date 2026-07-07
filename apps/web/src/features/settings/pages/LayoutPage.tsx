/**
 * BRD/task-list §5g scope is literally "entry point to record-page layout customization" — there's
 * no record page to lay out until generic record CRUD ships (Phase 6), so this is an honest
 * explanation rather than a builder with nothing behind it, same call as ObjectDetailPage's LayoutTab.
 */
export function LayoutPage() {
  return (
    <div>
      <h1 className="text-lg font-medium">Layout</h1>
      <p className="mt-1 text-sm text-muted-foreground">
        Record-page layout customization will be available once record pages themselves are built
        (Phase 6+) — there&apos;s nothing to lay out yet.
      </p>
    </div>
  );
}
