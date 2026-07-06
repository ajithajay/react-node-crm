import { useEffect } from 'react';
import type { ColorSchemeValue } from '@saasly/shared';

const STORAGE_KEY = 'saasly-color-scheme';

function prefersDark(): boolean {
  return window.matchMedia('(prefers-color-scheme: dark)').matches;
}

export function applyColorScheme(scheme: ColorSchemeValue): void {
  const isDark = scheme === 'DARK' || (scheme === 'SYSTEM' && prefersDark());
  document.documentElement.classList.toggle('dark', isDark);
  localStorage.setItem(STORAGE_KEY, scheme);
}

/** Read before first render so there's no flash of the wrong theme while `me` is still loading. */
export function getCachedColorScheme(): ColorSchemeValue {
  const cached = localStorage.getItem(STORAGE_KEY);
  return cached === 'LIGHT' || cached === 'DARK' || cached === 'SYSTEM' ? cached : 'SYSTEM';
}

/** Keeps <html>.dark in sync with the authoritative server value, including live OS-theme changes. */
export function useColorSchemeSync(scheme: ColorSchemeValue | undefined): void {
  useEffect(() => {
    if (!scheme) return;
    applyColorScheme(scheme);
    if (scheme !== 'SYSTEM') return;

    const media = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => applyColorScheme('SYSTEM');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [scheme]);
}
