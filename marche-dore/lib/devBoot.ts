import { userProfile as seedProfile } from '@/data/account';

/**
 * Boot démo + isolation crash.
 * Remettre les flags à false une fois stable.
 */
export const DEV_OPEN_HOME = false;
/** Accueil sans Reanimated (scroll/navbar) ni warm map. */
export const DEV_SAFE_HOME = true;

export function makeDevDemoSession() {
  return {
    accountId: 'demo-amina',
    email: 'demo@marchedore.bj',
    phone: seedProfile.phone,
    firstName: seedProfile.firstName,
    lastName: seedProfile.lastName,
    onboardingDone: true,
    birthDate: '',
    createdAt: '2024-03-01T00:00:00.000Z',
  };
}

export function logDev(...args: unknown[]) {
  console.log('[Marché Doré]', ...args);
}

export function logDevError(scope: string, error: unknown, extra?: unknown) {
  const err = error instanceof Error ? error : new Error(String(error ?? 'erreur'));
  console.error(`[Marché Doré ERROR] ${scope}:`, err.message, extra ?? '', err.stack ?? '');
}
