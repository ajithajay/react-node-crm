import { useMemo } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { UpdatePreferencesRequest } from '@saasly/shared';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { meApi } from '@/lib/api-client';
import { applyColorScheme } from '@/lib/theme';

const FALLBACK_TIME_ZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

function listTimeZones(): string[] {
  try {
    return Intl.supportedValuesOf('timeZone');
  } catch {
    return FALLBACK_TIME_ZONES;
  }
}

const APPEARANCE_OPTIONS: { value: UpdatePreferencesRequest['colorScheme']; label: string }[] = [
  { value: 'LIGHT', label: 'Light' },
  { value: 'DARK', label: 'Dark' },
  { value: 'SYSTEM', label: 'System' },
];

const DATE_FORMAT_OPTIONS: { value: UpdatePreferencesRequest['dateFormat']; label: string }[] = [
  { value: 'MM/DD/YYYY', label: 'MM/DD/YYYY (12/31/2026)' },
  { value: 'DD/MM/YYYY', label: 'DD/MM/YYYY (31/12/2026)' },
  { value: 'YYYY-MM-DD', label: 'YYYY-MM-DD (2026-12-31)' },
];

const TIME_FORMAT_OPTIONS: { value: UpdatePreferencesRequest['timeFormat']; label: string }[] = [
  { value: 'HH:mm', label: '24-hour (14:30)' },
  { value: 'hh:mm A', label: '12-hour (2:30 PM)' },
];

const NUMBER_FORMAT_OPTIONS: { value: UpdatePreferencesRequest['numberFormat']; label: string }[] = [
  { value: '1,000.00', label: '1,000.00' },
  { value: '1.000,00', label: '1.000,00' },
  { value: '1 000.00', label: '1 000.00' },
];

export function ExperiencePage() {
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: meApi.get });
  const timeZones = useMemo(listTimeZones, []);

  const update = useMutation({
    mutationFn: (input: UpdatePreferencesRequest) => meApi.updatePreferences(input),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['me'] }),
  });

  if (!me) return null;

  function patch(partial: Partial<UpdatePreferencesRequest>): void {
    if (!me) return;
    const next: UpdatePreferencesRequest = {
      colorScheme: me.colorScheme,
      timeZone: me.timeZone,
      dateFormat: me.dateFormat,
      timeFormat: me.timeFormat,
      numberFormat: me.numberFormat,
      ...partial,
    };
    if (partial.colorScheme) applyColorScheme(partial.colorScheme);
    update.mutate(next);
  }

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-lg font-medium">Experience</h1>
        <p className="mt-1 text-sm text-muted-foreground">Appearance and regional formats.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
        </CardHeader>
        <CardContent className="max-w-xs space-y-2">
          <Label>Theme</Label>
          <Select value={me.colorScheme} onValueChange={(value) => value && patch({ colorScheme: value as UpdatePreferencesRequest['colorScheme'] })}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {APPEARANCE_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Formats</CardTitle>
        </CardHeader>
        <CardContent className="grid max-w-md gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Timezone</Label>
            <Select value={me.timeZone} onValueChange={(value) => value && patch({ timeZone: value })}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="max-h-72">
                {timeZones.map((tz) => (
                  <SelectItem key={tz} value={tz}>
                    {tz}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Date format</Label>
            <Select
              value={me.dateFormat}
              onValueChange={(value) => value && patch({ dateFormat: value as UpdatePreferencesRequest['dateFormat'] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DATE_FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Time format</Label>
            <Select
              value={me.timeFormat}
              onValueChange={(value) => value && patch({ timeFormat: value as UpdatePreferencesRequest['timeFormat'] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIME_FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Number format</Label>
            <Select
              value={me.numberFormat}
              onValueChange={(value) => value && patch({ numberFormat: value as UpdatePreferencesRequest['numberFormat'] })}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {NUMBER_FORMAT_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
