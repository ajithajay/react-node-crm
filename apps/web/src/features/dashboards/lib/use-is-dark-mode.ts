import { useEffect, useState } from 'react';

/** Tracks the `.dark` class on `<html>` (same signal `theme.ts#useColorSchemeSync` writes) so chart
 * colors can pick their light/dark step without a full re-theme. */
export function useIsDarkMode(): boolean {
  const [isDark, setIsDark] = useState(() => document.documentElement.classList.contains('dark'));

  useEffect(() => {
    const observer = new MutationObserver(() => setIsDark(document.documentElement.classList.contains('dark')));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, []);

  return isDark;
}
