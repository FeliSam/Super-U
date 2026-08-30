import { useAuth } from '@/context/AuthContext';
import { useTheme, type ThemePreference } from '@/context/ThemeContext';
import { apiGetAccountState, apiPatchAccountState } from '@/lib/accountSync';
import { getAuthToken } from '@/lib/api/http';
import { useEffect, useRef } from 'react';

/** Applies / saves appearance preference per signed-in account. */
export function AccountPrefsSync() {
  const { session, ready } = useAuth();
  const { preference, setPreference } = useTheme();
  const accountId = session?.accountId ?? null;
  const skip = useRef(true);
  const lastAccount = useRef<string | null>(null);

  useEffect(() => {
    if (!ready || !accountId) {
      lastAccount.current = null;
      skip.current = true;
      return;
    }
    if (!getAuthToken() || lastAccount.current === accountId) return;
    lastAccount.current = accountId;
    skip.current = true;
    let active = true;
    (async () => {
      const state = await apiGetAccountState();
      if (!active) return;
      const theme = state?.prefs?.theme;
      if (theme === 'light' || theme === 'dark' || theme === 'system') {
        setPreference(theme);
      }
      skip.current = false;
    })();
    return () => {
      active = false;
    };
  }, [ready, accountId, setPreference]);

  useEffect(() => {
    if (!accountId || skip.current || !getAuthToken()) return;
    apiPatchAccountState({ prefs: { theme: preference as ThemePreference } });
  }, [preference, accountId]);

  return null;
}
