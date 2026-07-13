import { Skeleton } from '@/components/ui/skeleton';

export function WidgetLoading() {
  return (
    <div className="flex h-full flex-col gap-2 p-4">
      <Skeleton className="h-4 w-1/3" />
      <Skeleton className="h-full w-full" />
    </div>
  );
}

export function WidgetEmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">{message}</div>
  );
}
