export function SettingsPlaceholderPage({ title, phase }: { title: string; phase: string }) {
  return (
    <div>
      <h1 className="text-lg font-medium">{title}</h1>
      <p className="mt-1 text-sm text-muted-foreground">Coming in {phase}.</p>
    </div>
  );
}
