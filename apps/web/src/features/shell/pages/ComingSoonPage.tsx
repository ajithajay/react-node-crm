export function ComingSoonPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div className="flex h-full flex-col items-center justify-center gap-1 text-center">
      <h1 className="text-lg font-medium">{title}</h1>
      <p className="text-sm text-muted-foreground">Coming in {phase}.</p>
    </div>
  );
}
